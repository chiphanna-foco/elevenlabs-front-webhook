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

  // Log incoming payload for debugging
  console.log('ElevenLabs payload:', JSON.stringify(req.body, null, 2));

  // Try multiple paths where ElevenLabs might put the data
  const payload = req.body || {};
  const data = payload.analysis?.data_points
    || payload.analysis
    || payload.data
    || payload.call_id ? {} : payload;  // if it has call_id at root, fields are probably at root too

  // Also check root level for direct tool call parameters
  const root = payload;

  const ownerName = data.owner_name || root.owner_name || 'Unknown';
  const propertyAddress = data.property_address || root.property_address || 'Not provided';
  const availabilityDate = data.availability_date || root.availability_date || 'Not provided';
  const propertyStatus = data.property_status || root.property_status || 'Not provided';
  const isFurnished = data.is_furnished ?? root.is_furnished;
  const furnishedText = isFurnished === true ? 'Yes' : isFurnished === false ? 'No' : String(isFurnished || 'Not provided');
  const offeringPreference = data.offering_preference || root.offering_preference || 'Not provided';
  const callbackTime = data.callback_time || root.callback_time || 'Not provided';

  // Include raw payload for debugging
  const rawPayload = JSON.stringify(payload, null, 2);

  const body = `
    <h3>New Lead Captured via ElevenLabs Call</h3>
    <table>
      <tr><td><strong>Owner Name:</strong></td><td>${ownerName}</td></tr>
      <tr><td><strong>Property Address:</strong></td><td>${propertyAddress}</td></tr>
      <tr><td><strong>Availability Date:</strong></td><td>${availabilityDate}</td></tr>
      <tr><td><strong>Property Status:</strong></td><td>${propertyStatus}</td></tr>
      <tr><td><strong>Furnished:</strong></td><td>${furnishedText}</td></tr>
      <tr><td><strong>Offering Preference:</strong></td><td>${offeringPreference}</td></tr>
      <tr><td><strong>Callback Time:</strong></td><td>${callbackTime}</td></tr>
    </table>
    <hr>
    <details>
      <summary><strong>Raw Payload (debug)</strong></summary>
      <pre>${rawPayload}</pre>
    </details>
  `.trim();

  const subject = `New Lead: ${ownerName} - ${propertyAddress}`;

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
          external_id: req.body?.call_id || `call-${Date.now()}`,
          created_at: Math.floor(Date.now() / 1000),
          metadata: {
            thread_ref: req.body?.call_id || `call-${Date.now()}`,
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
