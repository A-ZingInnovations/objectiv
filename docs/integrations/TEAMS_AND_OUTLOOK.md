# Connect Microsoft Teams & Outlook to Objectiv

Published site guides (preferred for users):

- [Microsoft Teams](https://www.project-objectiv.com/learn/integrations/teams/)
- [Outlook / Microsoft 365 mail](https://www.project-objectiv.com/learn/integrations/outlook/)
- [Integrations overview](https://www.project-objectiv.com/integrations/)

## In-app (Settings → Integrations)

| Goal | Settings | Value |
|------|----------|--------|
| Teams chat | Chat Platform = Microsoft Teams | Chat Credential = Incoming Webhook URL |
| Teams meetings | Meetings Platform = Microsoft Teams | Meetings Credential = default join URL (optional) |
| Outlook / M365 | Mail (IMAP) | Host `outlook.office365.com`, port `993`, TLS on, full email + app password |

Enterprise seat required for agent on-behalf send (chat / mail / meetings). Credentials stay local.

## Maturity

- **Slack**: deepest live connector (Socket Mode + history in desktop).
- **Teams**: webhook credential + join-link meetings; Graph OAuth roadmap.
- **Outlook**: IMAP/POP mailbox connect; SMTP/Graph send path expanding.
