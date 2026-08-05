# Integracja Google Calendar (Availability Engine)

## Architecture
- We use OAuth2 to authenticate Auditors (B2B).
- `refresh_tokens` are stored securely in the database.
- We query the `freebusy` endpoint to determine availability.
- A custom engine (or BaaS like Cal.com API) is used to subtract working hours and travel time buffers to present final slots to the B2C client.

(To be detailed with exact API routes, endpoints, and data models)
