# Tether

A mobile-first private couples app built as an installable PWA. It includes daily check-ins, private chat, shared memories, prompts, plans, milestones, and a two-phone invite flow.

## Stack from the supplied Wappalyzer export

- PWA and Open Graph metadata
- Bootstrap 5 utility framework plus custom responsive CSS
- Firebase Authentication and Cloud Firestore
- Google Sign-in
- Firebase Hosting, with an optional Cloudflare layer later

Flutter/Dart and Bootstrap are alternative UI approaches: Bootstrap cannot style Flutter widgets. This build uses the web-native Bootstrap route so it can be previewed and deployed without the Flutter SDK while retaining the other detected technologies.

## Test locally

Serve this folder over HTTP rather than opening `index.html` directly. For example:

```bash
python3 -m http.server 3000
```

Without Firebase configuration, the app runs as a fully interactive single-phone demo and stores data in `localStorage`.

## Connect both phones with Firebase

1. Create a project in the Firebase Console and add a Web app.
2. In **Project settings → Your apps**, copy the Firebase configuration object.
3. Open `firebase-config.js` and replace `null` with that object.
4. In **Authentication → Sign-in method**, enable Google.
5. In **Firestore Database**, create a database. Choose production mode; the included rules supply the access policy.
6. Add your deployed domain under **Authentication → Settings → Authorized domains** if Firebase does not add it automatically.

After deployment, each person signs in. One taps **Create our space**, then privately sends the six-character code to the other person. The second person taps **Enter a code**.

## Deploy free with Firebase Hosting

Firebase's Spark plan supports a small personal app without a paid plan.

Install and authenticate the Firebase CLI on your computer:

```bash
npm install -g firebase-tools
firebase login
```

From this project folder, attach your Firebase project and deploy Hosting plus the secure Firestore rules:

```bash
firebase use --add
firebase deploy --only hosting,firestore:rules
```

The CLI prints the live address. Open it on both phones, then use the browser menu to choose **Add to Home Screen**. Future releases use the same deploy command.

## Privacy and production notes

- Firestore rules restrict reads and updates to the two authenticated member IDs.
- The invite code is a secret; share it only with your partner.
- Deleted spaces are intentionally blocked by the included rules. Add an explicit ownership model before implementing deletion.
- Photos are represented by color-led memory cards in this version. Real uploads require Firebase Storage and its own security rules.
- Firebase Analytics is intentionally omitted because private relationship data should not be tracked by default.
