import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';

const app = express();

const env = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeThinWebhookSecret: process.env.STRIPE_THIN_WEBHOOK_SECRET,
  platformSubscriptionPriceId: process.env.PLATFORM_SUBSCRIPTION_PRICE_ID,
  rootUrl: process.env.ROOT_URL || 'http://localhost:4242',
  connectedAccountCountry: process.env.CONNECTED_ACCOUNT_COUNTRY || 'us',
  currency: process.env.CURRENCY || 'usd',
  port: Number(process.env.PORT || 4242),
};

function requireEnv(name, value, help) {
  if (!value || value.includes('replace_me')) {
    throw new Error(
      `${name} is missing. ${help} Add it to examples/stripe-connect-v2-node/.env.`,
    );
  }
  return value;
}

const stripeClient = new Stripe(
  requireEnv(
    'STRIPE_SECRET_KEY',
    env.stripeSecretKey,
    'Create a sandbox secret key in the Stripe Dashboard API keys page.',
  ),
);

// Stripe sends webhook payloads as signed raw bytes. Normal pages and form
// posts can use Express parsers, but webhook routes must skip them so signature
// verification sees the exact body Stripe signed.
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next();
  express.urlencoded({ extended: true })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks/')) return next();
  express.json()(req, res, next);
});

const memoryStore = {
  users: new Map(),
  subscriptions: new Map(),
  requirementEvents: [],
};

// Demo-only persistence. In Pierre, this should be replaced by your owner/club
// tables, for example `club.stripe_connected_account_id` plus a subscription
// table keyed by the connected account id.
function getDemoUser() {
  const userId = 'demo-owner';
  if (!memoryStore.users.has(userId)) {
    memoryStore.users.set(userId, {
      id: userId,
      displayName: 'Pierre Test Seller',
      email: 'seller@example.com',
      connectedAccountId: null,
    });
  }
  return memoryStore.users.get(userId);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #111827; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 18px 56px; }
    h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { line-height: 1.5; color: #4b5563; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #eef0f3; padding-top: 12px; margin-top: 12px; }
    .muted { color: #6b7280; font-size: 14px; }
    .pill { display: inline-flex; align-items: center; border: 1px solid #d1d5db; border-radius: 999px; padding: 4px 10px; font-size: 13px; color: #374151; background: #fff; }
    button, .button { border: 0; border-radius: 6px; background: #2563eb; color: #fff; padding: 10px 14px; font-weight: 700; cursor: pointer; display: inline-block; }
    button.secondary, .button.secondary { background: #111827; }
    input, textarea, select { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; font: inherit; margin: 6px 0 12px; background: #fff; }
    label { font-weight: 700; font-size: 14px; }
    code { background: #eef2ff; color: #3730a3; padding: 2px 5px; border-radius: 4px; }
    pre { overflow: auto; background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function money(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

async function retrieveConnectedAccountStatus(accountId) {
  // Always fetch status directly from Stripe for this demo, as requested. The
  // `include` values are important for Accounts v2 because some nested fields
  // are only returned when explicitly included.
  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.merchant', 'configuration.customer', 'requirements'],
  });

  const cardStatus =
    account?.configuration?.merchant?.capabilities?.card_payments?.status || 'unknown';
  const requirementsStatus =
    account?.requirements?.summary?.minimum_deadline?.status || 'not_due';

  return {
    account,
    readyToProcessPayments: cardStatus === 'active',
    onboardingComplete:
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due',
    cardStatus,
    requirementsStatus,
  };
}

app.get('/', async (_req, res, next) => {
  try {
    const user = getDemoUser();
    let statusHtml = '<span class="pill">No connected account</span>';

    if (user.connectedAccountId) {
      const status = await retrieveConnectedAccountStatus(user.connectedAccountId);
      statusHtml = `<span class="pill">Account ${user.connectedAccountId}</span>
        <p class="muted">Card payments: <code>${status.cardStatus}</code></p>
        <p class="muted">Requirements: <code>${status.requirementsStatus}</code></p>`;
    }

    res.send(page('Stripe Connect V2 sample', `
      <h1>Stripe Connect V2 sample</h1>
      <p>This demo uses a single hard-coded seller. Replace that with your authenticated Pierre owner model.</p>
      <div class="grid">
        <section class="card">
          <h2>Connected account</h2>
          ${statusHtml}
          <form method="post" action="/connect/onboard">
            <button type="submit">Onboard to collect payments</button>
          </form>
          <div class="row">
            <a href="/dashboard">Seller dashboard</a>
            ${user.connectedAccountId ? `<a href="/store/${user.connectedAccountId}">Storefront</a>` : ''}
          </div>
        </section>
        <section class="card">
          <h2>Platform subscription</h2>
          <p>Charge the connected account for platform access using Accounts v2 as the customer.</p>
          <form method="post" action="/platform/create-subscription-plan">
            <button class="secondary" type="submit">Create sample subscription plan</button>
          </form>
        </section>
      </div>
    `));
  } catch (error) {
    next(error);
  }
});

app.post('/connect/onboard', async (_req, res, next) => {
  try {
    const user = getDemoUser();

    if (!user.connectedAccountId) {
      // Accounts v2 uses explicit responsibility and dashboard configuration.
      // Do not pass top-level `type`; legacy `express`, `standard`, and
      // `custom` account types are intentionally absent here.
      const account = await stripeClient.v2.core.accounts.create({
        display_name: user.displayName,
        contact_email: user.email,
        identity: {
          country: env.connectedAccountCountry,
          business_details: {
            phone: '0000000000',
          },
        },
        dashboard: 'full',
        defaults: {
          responsibilities: {
            fees_collector: 'stripe',
            losses_collector: 'stripe',
          },
        },
        configuration: {
          customer: {},
          merchant: {
            simulate_accept_tos_obo: true,
            capabilities: {
              card_payments: {
                requested: true,
              },
            },
          },
        },
        include: [
          'configuration.merchant',
          'configuration.recipient',
          'identity',
          'defaults',
          'configuration.customer',
        ],
      });

      user.connectedAccountId = account.id;
      // Persist this mapping before redirecting to onboarding. If the user
      // abandons onboarding and returns later, reuse the same account instead of
      // creating duplicates.
      memoryStore.users.set(user.id, user);
    }

    // Account Links create a short-lived Stripe-hosted onboarding URL. The
    // account collects both merchant information for payments and customer
    // information so the platform can charge subscription fees to the account.
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: user.connectedAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant', 'customer'],
          refresh_url: `${env.rootUrl}/dashboard?onboarding=refresh`,
          return_url: `${env.rootUrl}/dashboard?accountId=${user.connectedAccountId}`,
        },
      },
    });

    res.redirect(303, accountLink.url);
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', async (_req, res, next) => {
  try {
    const user = getDemoUser();
    if (!user.connectedAccountId) return res.redirect(303, '/');

    const status = await retrieveConnectedAccountStatus(user.connectedAccountId);
    const subscription = memoryStore.subscriptions.get(user.connectedAccountId);

    res.send(page('Seller dashboard', `
      <h1>Seller dashboard</h1>
      <p><a href="/">Back</a></p>
      <section class="card">
        <h2>Onboarding status</h2>
        <p>Connected account: <code>${user.connectedAccountId}</code></p>
        <p>Ready to process payments: <code>${String(status.readyToProcessPayments)}</code></p>
        <p>Onboarding complete: <code>${String(status.onboardingComplete)}</code></p>
        <p>Card payment capability: <code>${status.cardStatus}</code></p>
        <p>Requirements: <code>${status.requirementsStatus}</code></p>
        <form method="post" action="/connect/onboard">
          <button type="submit">Resume onboarding</button>
        </form>
      </section>

      <div class="grid">
        <section class="card">
          <h2>Create product on connected account</h2>
          <form method="post" action="/products">
            <label>Name<input name="name" value="Cookie"></label>
            <label>Description<textarea name="description">A sample storefront item.</textarea></label>
            <label>Price in cents<input name="priceInCents" type="number" min="50" value="1000"></label>
            <label>Currency<input name="currency" value="${env.currency}"></label>
            <button type="submit">Create product</button>
          </form>
        </section>

        <section class="card">
          <h2>Platform subscription</h2>
          <p>Current stored status: <code>${subscription?.status || 'not_subscribed'}</code></p>
          <form method="post" action="/platform/subscribe-checkout">
            <button type="submit">Subscribe with Checkout</button>
          </form>
          <form method="post" action="/platform/subscribe-from-balance">
            <button class="secondary" type="submit">Subscribe from Stripe balance</button>
          </form>
          <form method="post" action="/platform/billing-portal">
            <button class="secondary" type="submit">Open billing portal</button>
          </form>
        </section>
      </div>

      <p><a class="button" href="/store/${user.connectedAccountId}">Open storefront</a></p>
    `));
  } catch (error) {
    next(error);
  }
});

app.post('/products', async (req, res, next) => {
  try {
    const user = getDemoUser();
    if (!user.connectedAccountId) throw new Error('Create a connected account before creating products.');

    const priceInCents = Number(req.body.priceInCents);
    if (!Number.isInteger(priceInCents) || priceInCents < 50) {
      throw new Error('priceInCents must be an integer of at least 50.');
    }

    // Products are created on the connected account, not the platform. Passing
    // `stripeAccount` makes the SDK send the `Stripe-Account` header.
    await stripeClient.products.create(
      {
        name: req.body.name || 'Untitled product',
        description: req.body.description || undefined,
        default_price_data: {
          unit_amount: priceInCents,
          currency: req.body.currency || env.currency,
        },
      },
      {
        stripeAccount: user.connectedAccountId,
      },
    );

    res.redirect(303, `/store/${user.connectedAccountId}`);
  } catch (error) {
    next(error);
  }
});

app.get('/store/:accountId', async (req, res, next) => {
  try {
    const { accountId } = req.params;

    // Storefront inventory is read from the connected account. This keeps each
    // seller's catalog isolated and makes Checkout a direct charge on that
    // seller later in the flow.
    const products = await stripeClient.products.list(
      {
        limit: 20,
        active: true,
        expand: ['data.default_price'],
      },
      {
        stripeAccount: accountId,
      },
    );

    res.send(page('Storefront', `
      <h1>Storefront</h1>
      <p class="muted">Demo URL uses <code>${accountId}</code>. In production, use a seller slug and look up the account ID server-side.</p>
      <div class="grid">
        ${products.data.map((product) => {
          const price = product.default_price;
          const canBuy = price && typeof price !== 'string';
          return `<section class="card">
            <h2>${product.name}</h2>
            <p>${product.description || 'No description.'}</p>
            <p><strong>${canBuy ? money(price.unit_amount || 0, price.currency) : 'No default price'}</strong></p>
            ${canBuy ? `<form method="post" action="/store/${accountId}/checkout">
              <input type="hidden" name="priceId" value="${price.id}">
              <button type="submit">Buy</button>
            </form>` : ''}
          </section>`;
        }).join('') || '<section class="card"><p>No products yet.</p></section>'}
      </div>
    `));
  } catch (error) {
    next(error);
  }
});

app.post('/store/:accountId/checkout', async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { priceId } = req.body;
    if (!priceId) throw new Error('Missing priceId.');

    // Retrieve the Price through the connected account context so a malicious
    // customer cannot submit a Price ID from another account.
    const price = await stripeClient.prices.retrieve(priceId, {}, { stripeAccount: accountId });

    // Direct charge: the Checkout Session is created on the connected account,
    // and `application_fee_amount` monetizes the transaction for the platform.
    const session = await stripeClient.checkout.sessions.create(
      {
        line_items: [
          {
            price_data: {
              currency: price.currency,
              product: typeof price.product === 'string' ? price.product : price.product.id,
              unit_amount: price.unit_amount,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: 123,
        },
        mode: 'payment',
        payment_method_types: ['card'],
        success_url: `${env.rootUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.rootUrl}/store/${accountId}`,
      },
      {
        stripeAccount: accountId,
      },
    );

    res.redirect(303, session.url);
  } catch (error) {
    next(error);
  }
});

app.post('/platform/create-subscription-plan', async (_req, res, next) => {
  try {
    // This product/price lives on the platform account because it represents
    // your SaaS/platform fee charged to connected accounts.
    const product = await stripeClient.products.create({
      name: 'Platform subscription',
      default_price_data: {
        currency: env.currency,
        recurring: {
          interval: 'month',
        },
        unit_amount: 1000,
      },
    });

    res.send(page('Subscription plan created', `
      <h1>Subscription plan created</h1>
      <p>Set this in <code>.env</code> for future runs:</p>
      <pre>PLATFORM_SUBSCRIPTION_PRICE_ID=${product.default_price}</pre>
      <p><a href="/">Back</a></p>
    `));
  } catch (error) {
    next(error);
  }
});

app.post('/platform/subscribe-checkout', async (_req, res, next) => {
  try {
    const user = getDemoUser();
    if (!user.connectedAccountId) throw new Error('Create a connected account before subscribing.');

    const priceId = requireEnv(
      'PLATFORM_SUBSCRIPTION_PRICE_ID',
      env.platformSubscriptionPriceId,
      'Create a recurring platform Price in Stripe or click "Create sample subscription plan".',
    );

    // Hosted Checkout subscription flow. With Accounts v2, the connected
    // account ID is also usable as `customer_account`; do not create a separate
    // `cus_...` record for this path.
    const session = await stripeClient.checkout.sessions.create({
      customer_account: user.connectedAccountId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.rootUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.rootUrl}/dashboard?subscription=cancel`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    next(error);
  }
});

app.post('/platform/subscribe-from-balance', async (_req, res, next) => {
  try {
    const user = getDemoUser();
    if (!user.connectedAccountId) throw new Error('Create a connected account before subscribing.');

    const priceId = requireEnv(
      'PLATFORM_SUBSCRIPTION_PRICE_ID',
      env.platformSubscriptionPriceId,
      'Create a recurring platform Price in Stripe or click "Create sample subscription plan".',
    );

    // Blueprint flow: attach the connected account's Stripe balance as an
    // off-session payment method for platform subscription invoices.
    const setupIntent = await stripeClient.setupIntents.create({
      payment_method_types: ['stripe_balance'],
      confirm: true,
      customer_account: user.connectedAccountId,
      usage: 'off_session',
      payment_method_data: {
        type: 'stripe_balance',
      },
    });

    // The subscription is created at the platform level and charges the
    // connected account via `customer_account`.
    const subscription = await stripeClient.subscriptions.create({
      customer_account: user.connectedAccountId,
      default_payment_method: setupIntent.payment_method,
      items: [{ price: priceId, quantity: 1 }],
      payment_settings: {
        payment_method_types: ['stripe_balance'],
      },
    });

    memoryStore.subscriptions.set(user.connectedAccountId, {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId,
    });

    res.redirect(303, '/dashboard');
  } catch (error) {
    next(error);
  }
});

app.post('/platform/billing-portal', async (_req, res, next) => {
  try {
    const user = getDemoUser();
    if (!user.connectedAccountId) throw new Error('Create a connected account before opening billing portal.');

    // Billing Portal lets the connected account manage the platform
    // subscription, payment methods, invoices, and tax IDs from Stripe-hosted UI.
    const session = await stripeClient.billingPortal.sessions.create({
      customer_account: user.connectedAccountId,
      return_url: `${env.rootUrl}/dashboard`,
    });

    res.redirect(303, session.url);
  } catch (error) {
    next(error);
  }
});

app.get('/success', (req, res) => {
  res.send(page('Payment complete', `
    <h1>Payment complete</h1>
    <p>Checkout session: <code>${req.query.session_id || 'unknown'}</code></p>
    <p><a href="/">Back</a></p>
  `));
});

app.post('/webhooks/connect-requirements', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret = requireEnv(
      'STRIPE_THIN_WEBHOOK_SECRET',
      env.stripeThinWebhookSecret,
      'Start the Stripe CLI thin event listener and copy its signing secret.',
    );
    const signature = req.headers['stripe-signature'];
    // Thin events contain only enough information to identify what changed. The
    // SDK verifies the signature and returns a thin event shell; then we fetch
    // the full event data from Stripe.
    const thinEvent = stripeClient.parseThinEvent(req.body, signature, secret);
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id);

    switch (event.type) {
      case 'v2.core.account[requirements].updated':
      case 'v2.core.account[configuration.merchant].capability_status_updated':
      case 'v2.core.account[configuration.customer].capability_status_updated':
        memoryStore.requirementEvents.push({
          id: event.id,
          type: event.type,
          receivedAt: new Date().toISOString(),
        });
        break;
      default:
        console.log(`Unhandled thin event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Thin webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

app.post('/webhooks/subscriptions', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const secret = requireEnv(
      'STRIPE_WEBHOOK_SECRET',
      env.stripeWebhookSecret,
      'Start a normal Stripe CLI listener and copy its signing secret.',
    );
    const signature = req.headers['stripe-signature'];
    // Billing/subscription events in this sample use normal snapshot payloads,
    // so `constructEvent` returns the complete Event object after verification.
    const event = stripeClient.webhooks.constructEvent(req.body, signature, secret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.customer_account) {
          memoryStore.subscriptions.set(session.customer_account, {
            subscriptionId: session.subscription,
            status: 'checkout_completed',
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const accountId = subscription.customer_account;
        if (accountId) {
          memoryStore.subscriptions.set(accountId, {
            subscriptionId: subscription.id,
            status: subscription.status,
            priceId: subscription.items?.data?.[0]?.price?.id,
            quantity: subscription.items?.data?.[0]?.quantity,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            pauseCollection: subscription.pause_collection,
          });
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const accountId = invoice.customer_account;
        if (accountId) {
          const existing = memoryStore.subscriptions.get(accountId) || {};
          memoryStore.subscriptions.set(accountId, {
            ...existing,
            latestInvoiceId: invoice.id,
            latestInvoicePaidAt: new Date().toISOString(),
            status: existing.status || 'active',
          });
        }
        break;
      }
      case 'payment_method.attached':
      case 'payment_method.detached':
      case 'customer.updated':
      case 'customer.tax_id.created':
      case 'customer.tax_id.deleted':
      case 'customer.tax_id.updated':
      case 'billing_portal.configuration.created':
      case 'billing_portal.configuration.updated':
      case 'billing_portal.session.created':
        console.log(`Billing information event received: ${event.type}`);
        break;
      default:
        console.log(`Unhandled snapshot event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Snapshot webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).send(page('Error', `
    <h1>Something needs attention</h1>
    <p>${error.message}</p>
    <p><a href="/">Back</a></p>
  `));
});

app.listen(env.port, () => {
  console.log(`Stripe Connect V2 sample running at ${env.rootUrl}`);
});
