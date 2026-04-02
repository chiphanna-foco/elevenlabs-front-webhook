# ElevenLabs → Front Webhook Bridge

Vercel serverless function that receives post-call analysis webhooks from ElevenLabs and creates conversations in Front.

## Setup

1. Deploy to Vercel (auto-deploys from GitHub)
2. Set environment variables in Vercel dashboard:
   - `FRONT_API_TOKEN` — your Front API token
   - `FRONT_INBOX_ID` — your Front inbox ID (default: `1948041`)
3. Copy your deployed URL + `/api/webhook` into ElevenLabs webhook config

## ElevenLabs Data Points

The webhook expects these fields in `analysis.data_points`:

| Field | Type | Description |
|-------|------|-------------|
| `owner_name` | string | Property owner's name |
| `property_address` | string | Full property address |
| `availability_date` | string | When property is available |
| `property_status` | string | vacant, tenant_in_place, owner_occupied |
| `is_furnished` | boolean | Whether property is furnished |
| `offering_preference` | string | tenant_placement, full_management, zip_guarantee |
| `callback_time` | string | Best time to call back |

## Test

```bash
curl -X POST https://your-app.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test-123",
    "analysis": {
      "data_points": {
        "owner_name": "Jane Doe",
        "property_address": "123 Main St",
        "availability_date": "2025-02-01",
        "property_status": "vacant",
        "is_furnished": false,
        "offering_preference": "full_management",
        "callback_time": "Weekdays after 3pm"
      }
    }
  }'
```
