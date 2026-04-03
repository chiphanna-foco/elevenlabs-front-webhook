import { google } from 'googleapis';

// Map US states to IANA timezones
const STATE_TIMEZONES = {
  'alabama': 'America/Chicago', 'alaska': 'America/Anchorage', 'arizona': 'America/Phoenix',
  'arkansas': 'America/Chicago', 'california': 'America/Los_Angeles', 'colorado': 'America/Denver',
  'connecticut': 'America/New_York', 'delaware': 'America/New_York', 'florida': 'America/New_York',
  'georgia': 'America/New_York', 'hawaii': 'Pacific/Honolulu', 'idaho': 'America/Boise',
  'illinois': 'America/Chicago', 'indiana': 'America/Indiana/Indianapolis', 'iowa': 'America/Chicago',
  'kansas': 'America/Chicago', 'kentucky': 'America/New_York', 'louisiana': 'America/Chicago',
  'maine': 'America/New_York', 'maryland': 'America/New_York', 'massachusetts': 'America/New_York',
  'michigan': 'America/Detroit', 'minnesota': 'America/Chicago', 'mississippi': 'America/Chicago',
  'missouri': 'America/Chicago', 'montana': 'America/Denver', 'nebraska': 'America/Chicago',
  'nevada': 'America/Los_Angeles', 'new hampshire': 'America/New_York', 'new jersey': 'America/New_York',
  'new mexico': 'America/Denver', 'new york': 'America/New_York', 'north carolina': 'America/New_York',
  'north dakota': 'America/Chicago', 'ohio': 'America/New_York', 'oklahoma': 'America/Chicago',
  'oregon': 'America/Los_Angeles', 'pennsylvania': 'America/New_York', 'rhode island': 'America/New_York',
  'south carolina': 'America/New_York', 'south dakota': 'America/Chicago', 'tennessee': 'America/Chicago',
  'texas': 'America/Chicago', 'utah': 'America/Denver', 'vermont': 'America/New_York',
  'virginia': 'America/New_York', 'washington': 'America/Los_Angeles', 'west virginia': 'America/New_York',
  'wisconsin': 'America/Chicago', 'wyoming': 'America/Denver', 'dc': 'America/New_York',
  'district of columbia': 'America/New_York',
  // State abbreviations
  'al': 'America/Chicago', 'ak': 'America/Anchorage', 'az': 'America/Phoenix',
  'ar': 'America/Chicago', 'ca': 'America/Los_Angeles', 'co': 'America/Denver',
  'ct': 'America/New_York', 'de': 'America/New_York', 'fl': 'America/New_York',
  'ga': 'America/New_York', 'hi': 'Pacific/Honolulu', 'id': 'America/Boise',
  'il': 'America/Chicago', 'in': 'America/Indiana/Indianapolis', 'ia': 'America/Chicago',
  'ks': 'America/Chicago', 'ky': 'America/New_York', 'la': 'America/Chicago',
  'me': 'America/New_York', 'md': 'America/New_York', 'ma': 'America/New_York',
  'mi': 'America/Detroit', 'mn': 'America/Chicago', 'ms': 'America/Chicago',
  'mo': 'America/Chicago', 'mt': 'America/Denver', 'ne': 'America/Chicago',
  'nv': 'America/Los_Angeles', 'nh': 'America/New_York', 'nj': 'America/New_York',
  'nm': 'America/Denver', 'ny': 'America/New_York', 'nc': 'America/New_York',
  'nd': 'America/Chicago', 'oh': 'America/New_York', 'ok': 'America/Chicago',
  'or': 'America/Los_Angeles', 'pa': 'America/New_York', 'ri': 'America/New_York',
  'sc': 'America/New_York', 'sd': 'America/Chicago', 'tn': 'America/Chicago',
  'tx': 'America/Chicago', 'ut': 'America/Denver', 'vt': 'America/New_York',
  'va': 'America/New_York', 'wa': 'America/Los_Angeles', 'wv': 'America/New_York',
  'wi': 'America/Chicago', 'wy': 'America/Denver',
};

// Map spoken timezone names to IANA
const SPOKEN_TIMEZONES = {
  'eastern': 'America/New_York', 'est': 'America/New_York', 'et': 'America/New_York',
  'central': 'America/Chicago', 'cst': 'America/Chicago', 'ct': 'America/Chicago',
  'mountain': 'America/Denver', 'mst': 'America/Denver', 'mt': 'America/Denver',
  'pacific': 'America/Los_Angeles', 'pst': 'America/Los_Angeles', 'pt': 'America/Los_Angeles',
  'alaska': 'America/Anchorage', 'hawaii': 'Pacific/Honolulu',
};

function getTimezoneFromSpoken(spokenTz) {
  if (!spokenTz) return null;
  const lower = spokenTz.toLowerCase().trim();
  for (const [key, tz] of Object.entries(SPOKEN_TIMEZONES)) {
    if (lower.includes(key)) return tz;
  }
  return null;
}

function getTimezoneFromAddress(address) {
  if (!address) return 'America/Denver';
  const parts = address.toLowerCase().split(/[,\s]+/);
  for (const part of parts.reverse()) {
    if (STATE_TIMEZONES[part.trim()]) return STATE_TIMEZONES[part.trim()];
  }
  const lower = address.toLowerCase();
  for (const [state, tz] of Object.entries(STATE_TIMEZONES)) {
    if (state.includes(' ') && lower.includes(state)) return tz;
  }
  return 'America/Denver';
}

function parseCallbackToDateTime(callbackTime, timezone) {
  // Get current date in the property's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map(p => [p.type, p.value])
  );
  const todayLocal = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`);

  const lower = (callbackTime || '').toLowerCase().trim();
  if (!lower || lower === 'not provided') return null;

  let targetDate = new Date(todayLocal);

  // Parse relative days
  if (lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes('next week')) {
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (lower.includes('monday')) {
    const day = targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + ((1 - day + 7) % 7 || 7));
  } else if (lower.includes('tuesday')) {
    const day = targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + ((2 - day + 7) % 7 || 7));
  } else if (lower.includes('wednesday')) {
    const day = targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + ((3 - day + 7) % 7 || 7));
  } else if (lower.includes('thursday')) {
    const day = targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + ((4 - day + 7) % 7 || 7));
  } else if (lower.includes('friday')) {
    const day = targetDate.getDay();
    targetDate.setDate(targetDate.getDate() + ((5 - day + 7) % 7 || 7));
  } else {
    // Default to tomorrow if we can't parse the day
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Parse time
  let hour = 10; // default 10am
  let minute = 0;

  const noonMatch = lower.includes('noon') || lower.includes('12 pm') || lower.includes('12pm');
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);

  if (noonMatch) {
    hour = 12;
  } else if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase().replace(/\./g, '');
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (lower.includes('morning')) {
    hour = 9;
  } else if (lower.includes('afternoon')) {
    hour = 14;
  } else if (lower.includes('evening')) {
    hour = 17;
  }

  targetDate.setHours(hour, minute, 0, 0);

  // Format as YYYY-MM-DDTHH:MM:SS
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const h = String(targetDate.getHours()).padStart(2, '0');
  const min = String(targetDate.getMinutes()).padStart(2, '0');

  return `${y}-${m}-${d}T${h}:${min}:00`;
}

async function createCalendarEvent({ ownerName, callerEmail, callerPhone, propertyAddress, availabilityDate, propertyStatus, furnishedText, offeringPreference, callbackTime, summary, timezone }) {
  const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS;
  const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

  if (!GOOGLE_CREDENTIALS || !GOOGLE_CALENDAR_ID) {
    console.log('Google Calendar not configured. CREDENTIALS:', !!GOOGLE_CREDENTIALS, 'CALENDAR_ID:', !!GOOGLE_CALENDAR_ID);
    return null;
  }
  console.log('Google Calendar configured. Calendar ID:', GOOGLE_CALENDAR_ID.substring(0, 20) + '...');

  const dateTime = parseCallbackToDateTime(callbackTime, timezone);
  if (!dateTime) {
    console.log('Could not parse callback time, skipping calendar event');
    return null;
  }

  try {
    // Credentials may be base64-encoded or raw JSON
    let credStr = GOOGLE_CREDENTIALS;
    try {
      JSON.parse(credStr);
    } catch {
      credStr = Buffer.from(credStr, 'base64').toString('utf-8');
    }
    const credentials = JSON.parse(credStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const endDateTime = new Date(dateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30);
    const endStr = `${endDateTime.getFullYear()}-${String(endDateTime.getMonth() + 1).padStart(2, '0')}-${String(endDateTime.getDate()).padStart(2, '0')}T${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}:00`;

    const event = {
      summary: `Callback: ${ownerName}`,
      description: [
        `OWNER DETAILS`,
        `Name: ${ownerName}`,
        `Email: ${callerEmail}`,
        `Phone: ${callerPhone}`,
        `Timezone: ${timezone}`,
        '',
        `PROPERTY DETAILS`,
        `Address: ${propertyAddress}`,
        `Availability: ${availabilityDate}`,
        `Status: ${propertyStatus}`,
        `Furnished: ${furnishedText}`,
        '',
        `NEXT STEPS`,
        `Offering Preference: ${offeringPreference}`,
        `Requested callback: ${callbackTime}`,
        '',
        summary ? `CALL SUMMARY\n${summary}` : '',
      ].filter(Boolean).join('\n'),
      start: { dateTime, timeZone: timezone },
      end: { dateTime: endStr, timeZone: timezone },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    const result = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: event,
    });

    console.log('Calendar event created:', result.data.htmlLink);
    return result.data;
  } catch (err) {
    console.error('Calendar event error:', err.message);
    console.error('Calendar error details:', JSON.stringify(err.response?.data || err.errors || {}));
    console.error('Calendar error code:', err.code);
    return { error: err.message, details: err.response?.data || null, code: err.code, calendarId: GOOGLE_CALENDAR_ID };
  }
}

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

  const results = payload.data?.analysis?.data_collection_results || {};

  function getField(fieldName) {
    if (results[fieldName]?.value !== undefined && results[fieldName]?.value !== null) {
      return results[fieldName].value;
    }
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
  const callerEmail = getField('caller_email') || 'Not provided';
  const callerTimezone = getField('caller_timezone') || '';

  const summary = payload.data?.analysis?.transcript_summary || '';
  const conversationId = payload.data?.conversation_id || '';
  const callDuration = payload.data?.metadata?.call_duration_secs || 0;
  const callMinutes = Math.floor(callDuration / 60);
  const callSeconds = callDuration % 60;

  // Determine timezone: prefer caller's stated timezone, fall back to property address state
  const timezone = getTimezoneFromSpoken(callerTimezone) || getTimezoneFromAddress(propertyAddress);

  // Create Google Calendar event for callback
  let calendarEvent = null;
  if (callbackTime && callbackTime !== 'Not provided') {
    calendarEvent = await createCalendarEvent({
      ownerName, callerEmail, callerPhone, propertyAddress,
      availabilityDate, propertyStatus, furnishedText,
      offeringPreference, callbackTime, summary, timezone,
    });
  }

  const calendarLine = calendarEvent
    ? `<br><strong>Calendar Event:</strong> <a href="${calendarEvent.htmlLink}">View in Google Calendar</a>`
    : '';

  const body = `
    <h3>New Lead: ${ownerName}</h3>
    <table>
      <tr><td><strong>Owner Name:</strong></td><td>${ownerName}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${callerEmail}</td></tr>
      <tr><td><strong>Phone:</strong></td><td>${callerPhone}</td></tr>
      <tr><td><strong>Property Address:</strong></td><td>${propertyAddress}</td></tr>
      <tr><td><strong>Availability Date:</strong></td><td>${availabilityDate}</td></tr>
      <tr><td><strong>Property Status:</strong></td><td>${propertyStatus}</td></tr>
      <tr><td><strong>Furnished:</strong></td><td>${furnishedText}</td></tr>
      <tr><td><strong>Offering Preference:</strong></td><td>${offeringPreference}</td></tr>
      <tr><td><strong>Callback Time:</strong></td><td>${callbackTime} (${timezone})</td></tr>
      <tr><td><strong>Call Duration:</strong></td><td>${callMinutes}m ${callSeconds}s</td></tr>
    </table>
    ${summary ? `<br><strong>Summary:</strong> ${summary}` : ''}
    ${calendarLine}
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
    return res.status(200).json({
      status: 'success',
      front_response: result,
      calendar_event: calendarEvent?.htmlLink ? { link: calendarEvent.htmlLink } : calendarEvent,
    });
  } catch (err) {
    console.error('Error sending to Front:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
