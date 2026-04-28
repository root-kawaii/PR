# Stripe Connect V2 Sample

This is a self-contained Node/Express sample for Connect Accounts v2. It demonstrates:

- Creating and onboarding a connected account with `/v2/core/accounts`
- Reading onboarding and capability status from Stripe
- Creating products on the connected account with the `Stripe-Account` header
- Showing a simple storefront per connected account
- Creating direct-charge Checkout Sessions with an application fee
- Charging connected accounts a platform subscription
- Handling thin Connect requirement events and snapshot Billing events

The sample uses `stripe@^22.0.2`, the latest stable `stripe-node` release I found on GitHub releases for `stripe/stripe-node` as of April 25, 2026. It does not set an API version when creating the Stripe client, so the SDK/account default applies.

## Run

```bash
cd examples/stripe-connect-v2-node
npm install
cp .env.example .env
# Fill STRIPE_SECRET_KEY and webhook secrets in .env.
npm run dev
```

Open `http://localhost:4242`.

## Thin Connect Events

Accounts v2 requirement updates must use thin events. In development:

```bash
stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' --forward-thin-to localhost:4242/webhooks/connect-requirements
```

## Snapshot Billing Events

Subscription webhooks in this sample use normal snapshot events:

```bash
stripe listen --events 'customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,payment_method.attached,payment_method.detached,customer.updated,customer.tax_id.created,customer.tax_id.deleted,customer.tax_id.updated,billing_portal.configuration.created,billing_portal.configuration.updated,billing_portal.session.created,checkout.session.completed' --forward-to localhost:4242/webhooks/subscriptions
```

## Production Notes

The sample stores user-to-account and subscription mappings in memory so the flow is visible in one file. Replace the `memoryStore` calls with your database models before using this in production.

The storefront uses the connected account ID in the URL for clarity. In production, use a stable seller slug or internal ID and look up the connected account ID server-side.
