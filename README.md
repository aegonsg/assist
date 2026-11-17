# ADHAVAN.AI

A Next.js App Router application with MongoDB persistence. Verified contacts can chat; requests requiring the owner's help are routed to an owner inbox, and owner-written replies are delivered into the contact's chat.

## Run locally

1. Install Node.js 20.9 or later and run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Create a MongoDB Atlas database, allow the deployment environment to connect, and set `MONGODB_URI` and `MONGODB_DB_NAME`.
4. Generate a random `JWT_SECRET` (at least 32 characters). Set bootstrap values for `OWNER_USERNAME` and `OWNER_PASSWORD_HASH`. After the first successful owner login these credentials are stored in MongoDB; future owner credential changes are saved there from the owner dashboard. Generate the initial hash with:

   ```powershell
   node -e "require('bcryptjs').hash('replace-with-a-strong-password', 12).then(console.log)"
   ```

   Avoid sharing real credentials in chat or committing `.env.local`.
5. To receive push notifications, generate VAPID keys with `npm run push:keys`. Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`, and set `PUSH_CONTACT_EMAIL`.
6. (Optional) To let the assistant answer general questions itself and improve request routing, create a key in the [Groq console](https://console.groq.com/keys) and set `GROQ_API_KEY` (or `AI_API_KEY`) in `.env.local`. The default endpoint and model are shown in `.env.example`; `AI_BASE_URL` and `AI_MODEL` can be overridden for another compatible provider/model. Never paste the key into chat or commit it. Without a provider key, only greetings and locally recognized owner-dependent requests are handled; general knowledge answers are unavailable.
7. Create MongoDB indexes using `npm run db:indexes` (this includes automatic 72-hour chat/request cleanup), then run `npm run dev` and open <http://localhost:3000>.
8. For a first local run, use `npm run setup:local` after setting `MONGODB_URI` in `.env.local`. The script saves a random owner password hash and session secret, stores the owner profile as `ADHAVAN`, creates/resets the `test_user` account, and prints one-time login credentials. Save them privately. Then restart `npm run dev:local` and sign in at `/owner/login` or `/login`.

For normal use, sign into `/owner/login` and create contact accounts directly from ADHAVAN's owner dashboard by setting each person's name, username, and password. Existing one-time invitations from earlier versions remain claimable; they do not expire, are single-use, and can be invalidated by deleting the contact.

## Firebase deployment

This app uses dynamic Next.js server routes and MongoDB, so it cannot be deployed as a static Firebase Hosting site. Firebase's framework-aware Hosting integration is a preview, and Firebase has closed new participation in its framework experiment. The recommended Firebase path for new Next.js deployments is [Firebase App Hosting](https://firebase.google.com/docs/app-hosting), which requires the Blaze billing plan. The existing `firebase.json` is for the older framework-aware Hosting flow and does not by itself configure App Hosting.

Firebase has a no-cost Spark plan, but this dynamic app's recommended App Hosting deployment requires Blaze and an attached billing account. Blaze includes some no-cost quotas, but usage beyond them can incur charges. Do not switch plans or deploy without first reviewing current [Firebase pricing](https://firebase.google.com/pricing), configuring budget alerts, and confirming that billing is acceptable. MongoDB Atlas and the AI provider have separate limits and possible charges. The project ID previously provided is `adhav-assistant`; production deployment still requires securely configured server-side secrets (`MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `OWNER_USERNAME`, and `OWNER_PASSWORD_HASH`, plus optional AI and push values). Never put private credentials in `NEXT_PUBLIC_*` variables or commit them.

### Free hosting alternatives

- [Vercel Hobby](https://vercel.com/pricing) is the simplest alternative for a personal Next.js deployment and supports dynamic Next.js routes. It has monthly usage limits; deployments may pause until quotas reset if those are exceeded.
- [Netlify Free](https://www.netlify.com/pricing/) also supports the Next.js App Router, server-side rendering, and route handlers, with a monthly credit limit.
- Both options require production environment variables for the server-side secrets. MongoDB Atlas and Groq remain separate services with their own quotas and possible charges; a free hosting plan does not make those services or custom domains automatically free.

Review current provider plans and terms before deploying, since limits and eligibility can change. Static-only hosting is not sufficient for this app's authenticated API routes and MongoDB-backed data.

## Features and current boundaries

- Separate owner and contact login routes and role-scoped persistent HttpOnly cookies. Sessions last up to 400 days and remain across browser/app restarts until logout, account invalidation, or browser cookie cleanup; passwords are never stored in browser localStorage.
- User accounts are created directly by the owner with a name, username, and password. Existing one-time invites from earlier versions remain claimable; setting a password on an unclaimed legacy invite activates the account and invalidates that link.
- Chat messages and requests are automatically removed by MongoDB TTL indexes after 72 hours; TTL deletion can run a little after the exact expiry time.
- Users can bookmark private-chat and group-chat messages. Bookmarks are saved as user-owned copies in a separate MongoDB collection without a TTL index, so they remain after the source chat history expires. Removing a bookmark deletes its saved copy; deleting a user account removes that user's bookmarks.
- In the contact dashboard, the mobile private-chat view keeps its composer visible beneath a bounded, independently scrollable history. The chat title scrolls with the conversation, and the compact one-row composer leaves more room for recent messages. Select a message to reveal its save/remove action. Owners can edit owner-sent replies from the activity feed; edits update the delivered reply and its request record, while existing saved-message snapshots remain unchanged.
- Owners can search and filter the user directory, edit a user's name/username/password from the pencil control beside their username, disable accounts, and delete users. New user accounts are created directly with an owner-set password; passwords are stored as hashes and cannot be viewed. Groups can be created from active contacts; membership is enforced for reads and messages, and owners can inspect group membership and messages. Group messages also expire after 72 hours.
- The owner dashboard has a conversation list for registered contacts, with per-contact chat history and direct owner replies, plus a separate pending-requests tab ordered newest first. Owner replies are delivered exactly as typed without AI rewriting or text normalization. Owners can edit their own sent messages in the conversation.
- Owners can update their own username and password from dashboard account settings; password hashes are persisted in the MongoDB `ownerProfiles` collection.
- Contacts and push subscriptions persist in MongoDB.
- Owner conversations, inbox, and activity feed poll every three seconds; custom replies are kept out of the AI model and sent directly to the contact exactly as written.
- Web Push uses VAPID and a service worker. Owners can opt in to incoming request notifications, and contacts can opt in to owner reply/decline notifications. The enable control disappears after browser notification permission is granted; owners can send an optional test notification from the mobile dashboard menu. Push is unavailable until configured and permission is granted. On iOS/iPadOS, add the site to the Home Screen from Safari (iOS/iPadOS 16.4+) before expecting Web Push.
- User data reads are scoped to the signed-in contact. Disable increments the contact's session version to invalidate existing sessions.
- Groq-backed AI answers and intent classification are optional; without provider credentials, general questions cannot be answered and local rules may miss nuanced requests. Configure the provider before relying on direct AI answers or automatic escalation for arbitrary wording.

Before public use, add production rate limiting and complete operational hardening (login lockout, broader immutable audit coverage, backup/retention policy, encrypted vault management, and automated security tests). Never store or automatically send sensitive values through the assistant. The current version only delivers custom replies submitted by the owner.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

Test wrong credentials, reused invite links, disabled contacts, contact-to-owner route isolation, request creation, owner reply delivery, push subscription and stale push cleanup, and mobile layouts.
