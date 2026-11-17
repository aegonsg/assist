import { sendNotification, setVapidDetails } from "web-push";
import { getDb } from "@/lib/db";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  setVapidDetails(
    `mailto:${process.env.PUSH_CONTACT_EMAIL ?? "owner@example.com"}`,
    publicKey,
    privateKey
  );
  return true;
}

async function notifySubscriptions(
  filter: Record<string, unknown>,
  title: string,
  body: string,
  url: string
) {
  if (!configureWebPush()) return false;

  const db = await getDb();
  const subscriptions = await db.collection("pushSubscriptions").find(filter).toArray();
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendNotification(
          subscription.subscription,
          JSON.stringify({ title, body, url })
        );
        return true;
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await db.collection("pushSubscriptions").deleteOne({ _id: subscription._id });
          return false;
        }
        console.error("Web Push delivery failed", { statusCode });
        return false;
      }
    })
  );
  return results.some(Boolean);
}

export async function notifyOwner(title: string, body: string, requestId: string) {
  return notifySubscriptions(
    { $or: [{ role: "owner" }, { role: { $exists: false } }] },
    title,
    body,
    `/owner?request=${encodeURIComponent(requestId)}`
  );
}

export async function notifyContact(contactId: string) {
  return notifySubscriptions(
    { role: "user", contactId },
    "ADHAVAN sent you a reply",
    "Open your private chat to read the new message.",
    "/app"
  );
}
