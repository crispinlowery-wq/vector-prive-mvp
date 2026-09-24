# WhatsApp pilot setup

Vector Privé integrates directly with Meta's WhatsApp Cloud API. The channel is disabled by default and cannot send or accept messages until all credentials are configured.

## What the pilot supports

- Signed inbound text-message webhooks
- Duplicate provider-message protection
- Matching a sender to `clients.phone`
- A holding queue for unknown numbers
- Normal request creation, AI triage and audit events
- Human-operator replies during the open 24-hour service window
- Delivery/read status updates when Meta sends them

The pilot does not automatically book, approve, accept passport data, download attachments or send messages outside the service window. Template messages can be added after Meta approves the first utility templates.

## 1. Create the Meta test setup

1. In Meta for Developers, create a business app under the Vector Privé business portfolio.
2. Add **WhatsApp** to the app and open **API Setup**.
3. Use Meta's test number initially. Add one developer recipient number for testing.
4. Record the temporary access token and the test **Phone number ID**. Replace the temporary token with an appropriately scoped production system-user token before launch.
5. Copy the Meta app secret from the app's settings.

Meta getting-started documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

## 2. Deploy a public HTTPS API

Meta must be able to reach the API over HTTPS. The callback is:

```text
https://YOUR-API-DOMAIN/webhooks/whatsapp
```

Do not expose a laptop development server for real customer messages. A temporary tunnel may be used only for Meta's test number and synthetic test content.

## 3. Configure secrets

Set these in the API's managed secret store, not in source control:

```dotenv
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=meta-access-token
WHATSAPP_APP_SECRET=meta-app-secret
WHATSAPP_VERIFY_TOKEN=a-new-long-random-value
WHATSAPP_PHONE_NUMBER_ID=meta-phone-number-id
WHATSAPP_GRAPH_VERSION=v23.0
```

Restart the API after changing secrets. Production startup fails if WhatsApp is enabled with an incomplete configuration.

## 4. Register the webhook

In **WhatsApp → Configuration**:

1. Set the callback URL to the public `/webhooks/whatsapp` URL.
2. Enter the exact `WHATSAPP_VERIFY_TOKEN` value.
3. Subscribe the WhatsApp Business Account to the `messages` field.
4. Send Meta's test webhook and confirm it receives HTTP 200.

The API verifies `X-Hub-Signature-256` using the raw request bytes and the app secret before parsing or storing content.

Webhook reference: https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference

## 5. Match the pilot client

Store the client's WhatsApp number in `clients.phone` in international format, for example:

```text
+447700900123
```

The incoming Meta sender is normalised and must match that record. An unknown number is stored with `unmatched` status and can be reviewed by an operator at:

```text
GET /integrations/whatsapp/unmatched
```

Unknown numbers are never automatically assigned to a client. Phone recognition is not sufficient approval for payments, passport disclosure, delegate changes or bookings.

## 6. Test the pilot

1. Send a text message from the registered developer recipient to Meta's test number.
2. Confirm one new Vector Privé request is created with channel `whatsapp`.
3. Send the identical webhook again and confirm no duplicate request is created.
4. Sign in as an operator and reply through `POST /requests/{request_id}/messages/whatsapp`.
5. Confirm the outbound message appears on the test device and the stored status progresses from accepted/sent to delivered/read.
6. Test an unknown number and confirm it appears only in the holding queue.
7. Test a forged signature and confirm the API returns HTTP 401.

## Before a production number

- Complete Meta business and display-name verification.
- Publish the privacy notice and WhatsApp opt-in/opt-out process.
- Configure approved utility templates for replies outside the 24-hour service window.
- Add rate limiting, queue-backed webhook processing, alerts and retention deletion.
- Run a targeted security test of signature verification, sender matching and operator authorisation.
- Ensure support staff cannot approve consequential actions on the client's behalf.

Official pricing and message-category guidance: https://whatsappbusiness.com/products/platform-pricing/
