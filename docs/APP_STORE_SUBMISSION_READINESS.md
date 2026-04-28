# App Store Submission Readiness

Updated: 2026-04-18

## Code Changes Completed

- In-app account deletion flow added to the mobile Profile screen.
- Backend account deletion endpoint added at `DELETE /auth/account`.
- Account deletion now anonymizes personal data, clears sessions and push tokens, and blocks further access from stale JWTs by checking `users.deleted_at`.
- Real support, privacy, and terms links are now configurable in the Expo app config:
  - `EXPO_PUBLIC_SUPPORT_URL`
  - `EXPO_PUBLIC_PRIVACY_URL`
  - `EXPO_PUBLIC_TERMS_URL`
- Production app display name changed from `pierre_two` to `Pierre`.
- Dormant simulated payment copy removed from the home flow.
- Frontend typecheck passes and lint no longer has blocking errors.

## Required Runtime / Deployment Follow-Up

1. Run the new migration:
   - `DB/migrations/040_add_deleted_at_to_users.sql`
2. Ensure these public URLs are live and reachable on device:
   - `https://pierre.app/support`
   - `https://pierre.app/privacy`
   - `https://pierre.app/terms`
3. Set production Expo env vars if the default URLs should differ:
   - `EXPO_PUBLIC_SUPPORT_URL`
   - `EXPO_PUBLIC_PRIVACY_URL`
   - `EXPO_PUBLIC_TERMS_URL`
4. Build and test the iOS release build after the backend migration is applied.

## App Review Information To Prepare

### Reviewer Account

Provide one stable reviewer account with:

- Email: `REPLACE_ME`
- Password: `REPLACE_ME`
- Expected data loaded:
  - At least one future event
  - At least one table reservation
  - At least one ticket
  - At least one shareable payment link

### Review Notes Template

Use a note like this in App Store Connect:

> Pierre is a consumer app for discovering nightlife events, reserving tables, and managing tickets/bookings for real-world venue access and services.
>
> Test account:
> Email: `REPLACE_ME`
> Password: `REPLACE_ME`
>
> Important flows:
> 1. Log in with the provided test account.
> 2. Browse events from the Home or Search tab.
> 3. Open an event and reserve a table.
> 4. View existing bookings from the Acquisti tab.
> 5. Open the Profile tab to view support links, privacy policy, terms, and account deletion.
>
> Payments are for real-world event access / venue table service consumed outside the app.

## Privacy Disclosure Checklist

Based on the current codebase, review these data types in App Store Connect:

- Name
- Email address
- Phone number
- Date of birth
- User ID
- Purchase / reservation history
- Customer support contact data
- Push token
- Analytics events and screen views

Third-party processors currently visible in code:

- Stripe
- PostHog
- Expo Notifications / Expo push infrastructure

## Final Pre-Submission Checks

- Run backend migration 040 in the target environment.
- Confirm account deletion works end-to-end on a real device.
- Confirm privacy/terms/support URLs open successfully in-app.
- Confirm reviewer account credentials work.
- Confirm App Store Connect privacy answers match production behavior.
- Confirm screenshots and metadata show `Pierre`, not `pierre_two`.
