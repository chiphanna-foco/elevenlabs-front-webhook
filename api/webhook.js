export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FRONT_API_TOKEN = process.env.FRONT_API_TOKEN;
  const FRONT_INBOX_ID = process.env.FRONT_INBOX_ID;

  if (!FRONT_API_TOKEN || !FRONT_INBOX_ID) {
    console.error('Missing environment variables: FRONT_API_TOKEN or FRONT_INBOX_ID');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  console.log('ElevenLabs event type:', req.body?.type);

  const payload = req.body || {};

  // Only process post_call_transcription events (ignore post_call_audio, etc.)
  if (payload.type && payload.type !== 'post_call_transcription') {
    console.log(`Ignoring event type: ${payload.type}`);
    return res.status(200).json({ status: 'skipped', reason: `Ignoring event type: ${payload.type}` });
  }

  // ElevenLabs post_call_transcription sends data at:
  // data.analysis.data_collection_results.{field_name}.value
  // Note: some keys have trailing whitespace/tabs from the ElevenLabs dashboard
  const results = payload.data?.analysis?.data_collection_results || {};

  // Helper: look up a field by name, trimming keys to handle trailing tabs/spaces
  function getField(fieldName) {
    // Try exact match first
    if (results[fieldName]?.value !== undefined && results[fieldName]?.value !== null) {
      return results[fieldName].value;
    }
    // Try trimmed keys (ElevenLabs adds trailing tabs from dashboard copy/paste)
    for (const [key, val] of Object.entries(results)) {
      if (key.trim() === fieldName && val?.value !== undefined && val?.value !== null) {
        return val.value;
      }
    }
    return null;
  }

  const ownerName = getField('owner_name') || 'Unknown';
  const propertyAddress = getField('property_address') || 'Not provided';
  const availabilityDate = getField('availability_date') || 'Not provided';
  const propertyStatus = getField('property_status') || 'Not provided';
  const isFurnished = getField('is_furnished');
  const furnishedText = isFurnished === true ? 'Yes' : isFurnished === false ? 'No' : 'Not provided';
  const offeringPreference = getField('offering_preference') || 'Not provided';
  const callbackTime = getField('callback_time') || 'Not provided';
  const callerPhone = getField('caller_phone') || 'Not provided';

  // Pull summary and transcript from the payload
  const summary = payload.data?.analysis?.transcript_summary || '';
  const conversationId = payload.data?.conversation_id || '';
  const callDuration = payload.data?.metadata?.call_duration_secs || 0;
  const callMinutes = Math.floor(callDuration / 60);
  const callSeconds = callDuration % 60;

  const body = `
    <h3>New Lead: ${ownerName}</h3>
    <table>
      <tr><td><strong>Owner Name:</strong></td><td>${ownerName}</td></tr>
      <tr><td><strong>Phone:</strong></td><td>${callerPhone}</td></tr>
      <tr><td><strong>Property Address:</strong></td><td>${propertyAddress}</td></tr>
      <tr><td><strong>Availability Date:</strong></td><td>${availabilityDate}</td></tr>
      <tr><td><strong>Property Status:</strong></td><td>${propertyStatus}</td></tr>
      <tr><td><strong>Furnished:</strong></td><td>${furnishedText}</td></tr>
      <tr><td><strong>Offering Preference:</strong></td><td>${offeringPreference}</td></tr>
      <tr><td><strong>Callback Time:</strong></td><td>${callbackTime}</td></tr>
      <tr><td><strong>Call Duration:</strong></td><td>${callMinutes}m ${callSeconds}s</td></tr>
    </table>
    ${summary ? `<br><strong>Summary:</strong> ${summary}` : ''}
  `.trim();

  const subject = `New Lead: ${ownerName} - ${propertyAddress}`;
  const externalId = conversationId || `call-${Date.now()}`;

  try {
    const frontResponse = await fetch(
      `https://api2.frontapp.com/inboxes/${FRONT_INBOX_ID}/imported_messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FRONT_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            handle: 'elevenlabs-calls@ziprent.com',
            name: 'ElevenLabs Call Bot',
          },
          to: ['start@ziprent.com'],
          subject,
          body,
          body_format: 'html',
          external_id: externalId,
          created_at: Math.floor(Date.now() / 1000),
          metadata: {
            thread_ref: externalId,
            is_inbound: true,
          },
        }),
      }
    );

    if (!frontResponse.ok) {
      const errorText = await frontResponse.text();
      console.error('Front API error:', frontResponse.status, errorText);
      return res.status(500).json({ error: 'Failed to send to Front', details: errorText });
    }

    const result = await frontResponse.json();
    console.log('Front API success:', JSON.stringify(result));
    return res.status(200).json({ status: 'success', front_response: result });
  } catch (err) {
    console.error('Error sending to Front:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
