# Secure supplier-order email setup

The live app remains in draft-email mode until all steps are complete and
`secureOrderEmail` is enabled in `config.js`.

## 1. Verify the Woods domain with Resend

1. Create a Resend account at https://resend.com/signup.
2. Add `woodscoffeeshop.co.uk` under **Domains**.
3. Add only the DNS records supplied by Resend to the domain in GoDaddy.
   Do not remove or replace the existing Microsoft 365 MX, SPF or autodiscover
   records. If GoDaddy reports a conflicting record, stop and check it first.
4. Wait until the domain shows **Verified**.
5. Create a sending-only API key and copy it once.

## 2. Update the database

Run the current `supabase-orders.sql` in the Supabase SQL Editor. It is
idempotent and adds the secure sending state and provider reference fields.

## 3. Deploy the Edge Function

Deploy `supabase/functions/send-supplier-order/index.ts` as an Edge Function
named `send-supplier-order`. JWT verification must remain enabled.

Add this Edge Function secret in Supabase:

```text
RESEND_API_KEY=re_...
```

Do not put the API key in `config.js`, GitHub, or the browser application.
Supabase automatically supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to the function.

## 4. Enable secure sending

After a successful function test, add this property to `window.WOODS_CONFIG`
in `config.js` and publish the next build:

```js
secureOrderEmail: true
```

The app will then replace the mail-app handoff with an explicit confirmation
and **Send order from Woods** action.

