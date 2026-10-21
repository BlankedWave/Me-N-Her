# Tether / Me-N-Her: code upgrade package

**Source reviewed:** https://github.com/BlankedWave/Me-N-Her (public `main` branch, October 21, 2026).

This ZIP contains **replacement/new files for the existing repository**, not a standalone copy of the original project. The original HTML and CSS are kept and the upgraded JavaScript adds working UI controls and loads `enhancements.css` automatically.

## Apply without losing your original files

1. Download/clone the original GitHub repository onto your computer.
2. Make a Git commit or backup **before** changing files.
3. Copy these **four replacement/addition files** into the repository root:
   - `app.js` — replaces the old JavaScript
   - `firestore.rules` — replaces the old Firestore rules
   - `sw.js` — replaces the old service worker
   - `enhancements.css` — new stylesheet, loaded by upgraded `app.js`
4. Also copy `netlify.toml` (new optional Netlify config) and the `tests/` folder if desired. You may keep this README in the repo.
5. Do **not** delete your existing `index.html`, `styles.css`, `firebase-config.js`, `icon.svg`, or `manifest.webmanifest`. They are still needed.
6. Start a local HTTP server from the original repo folder: `python3 -m http.server 3000`. Open `http://localhost:3000` and exercise the demo.
7. Run `node --check app.js && node --check sw.js && node --test tests/core.test.cjs` to verify syntax and pure helpers.
8. Deploy **Firestore security rules first** using Firebase CLI from the project folder:
   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules
   ```
   Alternatively paste `firestore.rules` into Firebase Console > Firestore Database > Rules and publish.
9. Commit/push the modified GitHub repo. If your Netlify project is connected to GitHub, push will trigger its normal deployment (depending on site settings). Otherwise publish the repository via Netlify Deploys. Root publish directory is `.`; build command can be empty.
10. In Firebase Authentication > Settings > Authorized domains, check the exact deployed Netlify domain. Google Sign-In depends on it.
11. Open the new deployment on two different browsers/phones and **hard-refresh both** if a previous service worker remains installed.

## Migration and limitations

- Existing couples using old six-character codes can still join and update. Newly generated codes use eight cryptographically random characters.
- Existing root-level `state` data is retained, including existing messages/memories/plans. Legacy messages do not have sender UIDs, so the original `who` field is used for them. Old check-ins have no sender UID and cannot reliably be assigned to either partner; new check-ins are per-user.
- Existing local-only demo data is migrated from the old `tether-state` key when available. Each authenticated account now remembers its code under `tether-space:<uid>` on the device. Back up existing data before deploying.
- The new app uses Firestore transactions for independent changes to the shared state. This prevents common last-write-wins overwrites in the existing code. **It is still a single-document data model**: with many messages or images, it will eventually hit Firestore's 1 MiB document limit. The next architecture step should be per-message/per-plan/per-memory Firestore subcollections, pagination and matching rules.
- **Transactions require a connection**; edits made while offline may fail and be reverted. The app shell remains usable offline for previously cached assets, and the demo works locally.
- Firestore protects access through authorization rules. This is **not end-to-end encryption**; do not advertise it as such.
- Account deletion, partner removal, an expiring invite token, media upload and robust offline mutation queues are **not included**. They need a deliberate data model and backend policies.
- The Netlify account dashboard is private; this package was produced from public GitHub source and was **not deployed** or tested against your private Firebase project.
- For high assurance, run Firebase Emulator Suite tests for authorized/uninvited third parties, an owner ID replacement attempt, and a third partner joining a full couple before production deployment. The local Node tests do not test Firestore's enforcement.

## What this upgrade implements

- Safer Firestore join and update permissions; original member cannot be replaced during joining.
- Secure eight-character invitation codes and collision-safe creation rules.
- Firebase Google login with popup-blocked redirect fallback; auth-aware space restore/sign-out.
- Sender-aware messages, actual per-user check-ins and calculated streaks.
- Transactions for chat, memories, plans, check-ins and preferences instead of overwriting all remote state from localStorage.
- Working preferences and anniversary, personal names/avatars, dynamic day counter and next-plan card.
- Date-and-time plans, memory/plan deletion, data export, accurate empty states.
- Working previously dead settings buttons and a new "Export data"/"Sign out" option.
- Disabled the attachment control clearly (because upload security rules/storage are not implemented).
- UI improvements to focus states, mobile spacing, tap targets, reduced motion, empty states and copy.
- Network-first service worker plus versioned cache cleanup, so changes can reach returning users.

## Recommended next features (not implemented)

1. **Reliable data architecture:** Firestore subcollections for `messages`, `plans`, `moments`, `checkins`; member-specific profiles; pagination; offline write queues; snapshot conflict tests.
2. **Real photo memories:** Firebase Storage with content type/size validation, authorized download URLs and per-couple Storage rules.
3. **Couple lifecycle and safety:** one-time expiring server-side invitations, remove/leave partner, export+delete account/data, clear consent UI, rate limits / App Check.
4. **Date planner:** calendar view, reminders with opt-in web push, timezone handling, RSVP, anniversary notifications.
5. **Chat quality:** read receipts, timestamp grouping, edit/delete individual messages, optional notification settings, search.
6. **Personalization:** dark mode, accessible font sizes, themes, photos/avatars, optional labels/pronouns.
7. **Tests & observability:** browser end-to-end flows, Firebase emulator tests, CI on GitHub Actions, error reporting without storing private message contents.
