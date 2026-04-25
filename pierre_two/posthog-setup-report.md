<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. PostHog was already partially integrated — the package (`posthog-react-native`), provider (`PostHogProvider`), analytics config (`config/analytics.ts`), user identification (`context/AuthContext.tsx`), and a large set of event tracking calls were already in place. The wizard completed the integration by:

1. **Setting environment variables** — wrote `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` to `.env` (previously the file was missing the actual key and defaulting to the EU host).
2. **Added missing event tracking** — added 5 new events in two files that had no tracking despite having significant business value.

| Event | Description | File |
|---|---|---|
| `profile_logout_initiated` | User taps the logout button on the profile screen | `app/(tabs)/profile.tsx` |
| `profile_notifications_requested` | User taps the push notifications row to enable notifications | `app/(tabs)/profile.tsx` |
| `profile_phone_verification_initiated` | User opens the phone verification section on the profile screen | `app/(tabs)/profile.tsx` |
| `ticket_qr_expanded` | User expands a ticket card to reveal the QR code | `app/(tabs)/tickets.tsx` |
| `ticket_qr_collapsed` | User collapses a ticket QR code back to compact card view | `app/(tabs)/tickets.tsx` |

The project already had extensive tracking across the entire funnel: auth (login/register/logout/delete account), event discovery (home screen, event card, event detail), table reservation flow (modal opened, payment sheet, payment cancelled/completed, share sheet), guest payment flow (preview loaded, checkout submitted/redirected/failed), and push notifications.

## Next steps

We've built a dashboard and five insights for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/394797/dashboard/1503931

- **Registration Funnel** — steps from account creation to phone verification completion:
  https://us.posthog.com/project/394797/insights/kuwyjUW6

- **Table Reservation Conversion Funnel** — event card → event detail → reserve tapped → payment started → reservation completed:
  https://us.posthog.com/project/394797/insights/T97J2G88

- **Guest Payment Conversion Funnel** — payment link opened → checkout submitted → redirected to Stripe:
  https://us.posthog.com/project/394797/insights/Wy3dmGHN

- **Daily Active Users** — DAU trend for logins and home screen opens over the last 30 days:
  https://us.posthog.com/project/394797/insights/DOj8r5IR

- **Login Success vs Failure Rate** — daily comparison of successful vs failed login attempts:
  https://us.posthog.com/project/394797/insights/Oh9hUNTc

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
