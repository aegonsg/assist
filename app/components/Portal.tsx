"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Message = { _id: string; role: string; text: string; createdAt: string };
type SavedMessage = {
  _id: string;
  sourceType: "chat" | "group";
  sourceMessageId: string;
  groupName?: string;
  senderName: string;
  text: string;
  createdAt: string;
  savedAt: string;
};
type RequestItem = {
  _id: string;
  contactName: string;
  summary: string;
  category: string;
  status: string;
  createdAt: string;
};
type FeedMessage = Message & { contactName: string };
type ContactItem = { _id: string; name: string; username: string; disabled: boolean; registered: boolean; lastActiveAt?: string };
type ContactFilter = "all" | "active" | "disabled" | "invites";
type GroupMessage = { _id: string; groupId: string; senderId: string; senderName: string; text: string; createdAt: string };
type UserGroup = { _id: string; name: string; members: string[]; messages: GroupMessage[] };
type OwnerGroup = { _id: string; name: string; memberIds: string[]; members: { _id: string; name: string; username: string }[]; messages: GroupMessage[] };
type UserSection = "chat" | "requests" | "groups" | "saved";
type OwnerSection = "inbox" | "activity" | "users" | "groups" | "settings";

const panel = "glass rounded-3xl p-4 sm:p-6";
const field = "w-full rounded-xl border border-red-300/20 bg-black/70 px-4 py-3 text-white outline-none transition focus:border-red-400";
const button = "rounded-xl bg-red-500 px-4 py-3 font-semibold text-black transition hover:bg-red-400 disabled:opacity-50";
const userSections: { id: UserSection; label: string }[] = [
  { id: "chat", label: "Chat with ADHAVAN" },
  { id: "requests", label: "My requests" },
  { id: "groups", label: "Group chats" },
  { id: "saved", label: "Saved messages" },
];
const userSectionIds: readonly UserSection[] = ["chat", "requests", "groups", "saved"];
const ownerSections: { id: OwnerSection; label: string }[] = [
  { id: "inbox", label: "Request inbox" },
  { id: "activity", label: "Message activity" },
  { id: "users", label: "User management" },
  { id: "groups", label: "Group chats" },
  { id: "settings", label: "Account settings" },
];
const ownerSectionIds: readonly OwnerSection[] = ["inbox", "activity", "users", "groups", "settings"];

function useSectionNavigation<T extends string>(defaultSection: T, validSections: readonly T[]) {
  const [section, setSection] = useState<T>(defaultSection);

  useEffect(() => {
    function syncFromLocation() {
      const requested = window.location.hash.slice(1) as T;
      setSection(validSections.includes(requested) ? requested : defaultSection);
    }
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [defaultSection, validSections]);

  function navigate(nextSection: T) {
    setSection(nextSection);
    const url = new URL(window.location.href);
    url.hash = nextSection;
    window.history.pushState(null, "", url);
  }

  return [section, navigate] as const;
}

function SectionNavigation<T extends string>({
  sections,
  active,
  defaultSection,
  onNavigate,
  menuActions = [],
}: {
  sections: { id: T; label: string }[];
  active: T;
  defaultSection: T;
  onNavigate: (section: T) => void;
  menuActions?: { id: string; label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentLabel = sections.find((section) => section.id === active)?.label;
  return (
    <div className="mb-5 space-y-3">
      <div className="relative">
        <nav aria-label="Dashboard menu" className="glass hidden gap-2 overflow-x-auto rounded-2xl p-2 sm:flex">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-current={active === section.id ? "page" : undefined}
              onClick={() => onNavigate(section.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${active === section.id ? "bg-red-600 font-medium text-white shadow-lg shadow-red-950/40" : "text-red-100/75 hover:bg-red-950/50 hover:text-white"}`}
            >
              {section.label}
            </button>
          ))}
          {menuActions.length > 0 && (
            <>
              <span aria-hidden="true" className="my-1 border-l border-white/10" />
              {menuActions.map((action) => (
                <button key={action.id} type="button" onClick={action.onClick} className={`shrink-0 rounded-xl px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${action.danger ? "border border-red-300/25 text-red-100 hover:bg-red-950/50" : "text-slate-300 hover:bg-red-950/50 hover:text-white"}`}>
                  {action.label}
                </button>
              ))}
            </>
          )}
        </nav>
        <div className="sm:hidden">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="glass flex min-h-12 w-full items-center justify-between rounded-2xl px-4 py-3 text-sm text-red-50"
          >
            <span className="flex items-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-red-300">
                {menuOpen
                  ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  : <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
              </svg>
              <span className="font-medium">Menu</span>
              <span className="text-red-200">{currentLabel}</span>
            </span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`h-4 w-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}>
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {menuOpen && (
            <nav id="mobile-dashboard-menu" aria-label="Dashboard menu" className="glass absolute inset-x-0 top-[calc(100%+8px)] z-20 rounded-2xl p-2 shadow-2xl">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active === section.id ? "page" : undefined}
                  onClick={() => {
                    onNavigate(section.id);
                    setMenuOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${active === section.id ? "bg-red-600/90 font-medium text-white" : "text-red-100 hover:bg-red-950/55"}`}
                >
                  <span>{section.label}</span>
                  {index === 0 && <span className="ml-3 text-[10px] uppercase tracking-wider text-red-200/75">Dashboard</span>}
                </button>
              ))}
              {menuActions.length > 0 && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  {menuActions.map((action) => (
                    <button key={action.id} type="button" onClick={() => { action.onClick(); setMenuOpen(false); }} className={`flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm hover:bg-red-950/55 ${action.danger ? "text-red-200" : "text-red-100"}`}>
                      {action.label}
                    </button>
                  ))}
                </>
              )}
            </nav>
          )}
        </div>
      </div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 px-1 text-xs text-slate-400 sm:text-sm">
        <button type="button" onClick={() => onNavigate(defaultSection)} className="transition hover:text-red-200">Dashboard</button>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-red-100">{currentLabel}</span>
      </nav>
    </div>
  );
}

function NeuralMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`ai-mark ${className}`} viewBox="0 0 48 48" fill="none">
      <path d="M24 5 41 15v18L24 43 7 33V15L24 5Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
      <path d="M24 5v12m17-2-10 6m10 12-10-6M24 43V31M7 33l10-6M7 15l10 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ErrorText({ children }: { children: string }) {
  return <p role="alert" className="mt-3 text-sm text-rose-300">{children}</p>;
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support Web Push.");
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push notifications are not configured yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(
      atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
      (char) => char.charCodeAt(0)
    ),
  });
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not enable notifications.");
}

function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    function syncPermission() {
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    }
    syncPermission();
    document.addEventListener("visibilitychange", syncPermission);
    return () => document.removeEventListener("visibilitychange", syncPermission);
  }, []);

  return permission;
}

export function LoginForm({ owner = false }: { owner?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${owner ? "owner-login" : "user-login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      router.push(owner ? "/owner" : "/app");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-5 sm:py-12">
      <section className={`${panel} w-full max-w-md`}>
        <Link href="/" className="flex items-center gap-2 text-sm text-red-200"><NeuralMark className="h-7 w-7" /> ADHAVAN.AI</Link>
        <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-300/20 px-3 py-2 text-sm text-red-100 transition hover:border-red-300/50 hover:bg-red-950/40">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M19 12H5m0 0 6 6m-6-6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to homepage
        </Link>
        <p className="mt-8 text-xs uppercase tracking-[0.25em] text-red-300">{owner ? "ADHAVAN // COMMAND ACCESS" : "VERIFIED CONTACT ACCESS"}</p>
        <h1 className="mt-2 text-3xl font-semibold">{owner ? "Welcome back, ADHAVAN" : "Welcome to ADHAVAN's network"}</h1>
        <p className="mt-2 text-sm text-stone-300">{owner ? "Review requests and send a personal reply from your private AI command center." : "Sign in with the invitation credentials ADHAVAN shared with you."}</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-slate-300">Username<input name="username" required autoComplete="username" className={`${field} mt-2`} /></label>
          <label className="block text-sm text-slate-300">Password<input name="password" type="password" required autoComplete={owner ? "current-password" : "current-password"} className={`${field} mt-2`} /></label>
          <button className={`${button} w-full`} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      </section>
    </main>
  );
}

export function ClaimForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: form.get("name"), username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to claim this invite.");
      router.push("/app");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to claim this invite.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-5 sm:py-12">
      <section className={`${panel} w-full max-w-md`}>
        <Link href="/" className="flex items-center gap-2 text-sm text-red-200"><NeuralMark className="h-7 w-7" /> ADHAVAN.AI</Link>
        <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-300/20 px-3 py-2 text-sm text-red-100 transition hover:border-red-300/50 hover:bg-red-950/40">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M19 12H5m0 0 6 6m-6-6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to homepage
        </Link>
        <p className="mt-6 text-xs uppercase tracking-[0.25em] text-red-300">PRIVATE CONTACT INVITATION</p>
        <h1 className="mt-2 text-3xl font-semibold">Create your account</h1>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-slate-300">Your name<input name="name" required maxLength={80} className={`${field} mt-2`} /></label>
          <label className="block text-sm text-slate-300">Username<input name="username" required minLength={3} maxLength={64} className={`${field} mt-2`} /></label>
          <label className="block text-sm text-slate-300">Password (10+ characters)<input name="password" type="password" minLength={10} required className={`${field} mt-2`} /></label>
          <button className={`${button} w-full`} disabled={busy}>{busy ? "Creating account…" : "Claim invitation"}</button>
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      </section>
    </main>
  );
}

export function UserPortal() {
  const router = useRouter();
  const pushPermission = useNotificationPermission();
  const [section, navigate] = useSectionNavigation<UserSection>("chat", userSectionIds);
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [userId, setUserId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [text, setText] = useState("");
  const [groupText, setGroupText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [savingMessageIds, setSavingMessageIds] = useState<string[]>([]);

  const expireSession = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const refresh = useCallback(async () => {
    const [response, groupsResponse, savedResponse] = await Promise.all([
      fetch("/api/user/requests", { cache: "no-store" }),
      fetch("/api/user/groups", { cache: "no-store" }),
      fetch("/api/user/saved", { cache: "no-store" }),
    ]);
    if (response.status === 401 || groupsResponse.status === 401 || savedResponse.status === 401) {
      await expireSession();
      return;
    }
    if (!response.ok || !groupsResponse.ok || !savedResponse.ok) throw new Error("Unable to refresh your messages.");
    const [data, groupData, savedData] = await Promise.all([response.json(), groupsResponse.json(), savedResponse.json()]);
    setMessages(data.messages);
    setRequests(data.requests);
    setGroups(groupData.groups);
    setUserId(groupData.currentUserId);
    setSavedMessages(savedData.messages);
  }, [expireSession]);

  const savedBySource = new Map(savedMessages.map((saved) => [`${saved.sourceType}:${saved.sourceMessageId}`, saved]));

  async function toggleSavedMessage(sourceType: "chat" | "group", messageId: string, groupId?: string) {
    const saved = savedBySource.get(`${sourceType}:${messageId}`);
    setSavingMessageIds((ids) => [...ids, messageId]);
    setError("");
    try {
      const response = await fetch("/api/user/saved", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saved ? { id: saved._id } : { sourceType, messageId, ...(groupId ? { groupId } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update saved messages.");
      const savedResponse = await fetch("/api/user/saved", { cache: "no-store" });
      const savedData = await savedResponse.json();
      if (!savedResponse.ok) throw new Error(savedData.error ?? "Could not refresh saved messages.");
      setSavedMessages(savedData.messages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update saved messages.");
    } finally {
      setSavingMessageIds((ids) => ids.filter((id) => id !== messageId));
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh().catch((reason) => setError(reason.message));
    }, 0);
    const timer = window.setInterval(() => void refresh().catch((reason) => setError(reason.message)), 3000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/user/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Message could not be sent.");
      setText("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function sendGroupMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = groupText.trim();
    const group = groups.find((item) => item._id === selectedGroupId) ?? groups[0];
    if (!message || !group) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/user/groups/${group._id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Group message could not be sent.");
      setGroupText("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Group message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await expireSession();
  }

  async function enablePush() {
    try {
      await subscribeToPush();
      setNotice("Notifications are enabled for replies from ADHAVAN.");
      document.dispatchEvent(new Event("visibilitychange"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not enable notifications.");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-[0.2em] text-red-100"><NeuralMark className="h-8 w-8" /> ADHAVAN<span className="text-red-500">.AI</span></Link>
      </header>
      <SectionNavigation
        sections={userSections}
        active={section}
        defaultSection="chat"
        onNavigate={navigate}
        menuActions={[
          ...(pushPermission === "default" ? [{ id: "enable-push", label: "Enable notifications", onClick: () => void enablePush() }] : []),
          ...(pushPermission === "denied" ? [{ id: "push-blocked", label: "Notifications blocked in browser settings", onClick: () => setError("Allow notifications for this site in your browser settings, then reload the page.") }] : []),
          { id: "logout", label: "Log out", onClick: logout, danger: true },
        ]}
      />
      {notice && <p className="mb-4 rounded-xl border border-red-300/30 bg-red-950/50 p-3 text-sm text-red-100">{notice}</p>}
      {error && <ErrorText>{error}</ErrorText>}
      {(section === "chat" || section === "requests") && <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {section === "chat" && <section className={`${panel} flex min-h-[72vh] flex-col`}>
          <div className="border-b border-white/10 pb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">PRIVATE LINK // ADHAVAN</p>
            <h1 className="mt-1 text-2xl font-semibold">Chat with ADHAVAN&apos;s assistant</h1>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto py-5" aria-live="polite">
            {messages.length === 0 && <p className="text-sm text-slate-400">No messages yet. Send a message to get started.</p>}
            {messages.map((message) => (
              <article key={message._id} className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === "user" ? "ml-auto border border-red-500/20 bg-red-950/60" : message.role === "owner" ? "border border-red-300/35 bg-red-950/45" : "border border-white/5 bg-black/70"}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs capitalize text-slate-400">{message.role === "owner" ? "Owner reply" : message.role === "bot" ? "Assistant" : "You"}</p>
                  {message.text !== "Delivered" && <button type="button" onClick={() => void toggleSavedMessage("chat", message._id)} disabled={savingMessageIds.includes(message._id)} aria-label={savedBySource.has(`chat:${message._id}`) ? "Remove saved message" : "Save message"} className="text-xs text-red-200 transition hover:text-white disabled:opacity-50">
                    {savedBySource.has(`chat:${message._id}`) ? "Saved" : "Save"}
                  </button>}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
              </article>
            ))}
          </div>
          <form onSubmit={send} className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
            <label htmlFor="chat-message" className="sr-only">Your message</label>
            <textarea id="chat-message" value={text} onChange={(event) => setText(event.target.value)} rows={2} maxLength={2000} placeholder="Ask anything…" className={`${field} resize-none`} />
            <button disabled={busy || !text.trim()} className={`${button} sm:self-end`}>{busy ? "…" : "Send"}</button>
          </form>
          {error && <ErrorText>{error}</ErrorText>}
        </section>}
        {section === "requests" && <aside className={panel}>
          <p className="text-xs uppercase tracking-[0.2em] text-red-300">YOUR REQUESTS</p>
          <h2 className="mt-1 text-xl font-semibold">Request updates</h2>
          <div className="mt-5 space-y-3">
            {requests.length === 0 && <p className="text-sm text-slate-400">No requests yet.</p>}
            {requests.map((item) => (
              <article key={item._id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-xs uppercase tracking-wider text-red-300">{item.status}</p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-200">{item.summary}</p>
                {item.status === "pending" && <p className="mt-2 text-xs text-stone-400">This request is being reviewed. An update will appear here.</p>}
                {item.status === "expired" && <p className="mt-1 text-xs text-amber-300">This request expired. You can ask again.</p>}
              </article>
            ))}
          </div>
        </aside>}
      </div>}
      {section === "groups" && <section className={`${panel} mt-5`}>
        <p className="text-xs uppercase tracking-[0.2em] text-red-300">MEMBER CHANNELS</p>
        <h2 className="mt-1 text-xl font-semibold">Your groups</h2>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">You haven&apos;t been added to a group yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <nav aria-label="Your groups" className="flex gap-2 overflow-x-auto lg:flex-col">
              {groups.map((group) => (
                <button key={group._id} onClick={() => setSelectedGroupId(group._id)} className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm ${group._id === (groups.find((item) => item._id === selectedGroupId)?._id ?? groups[0]._id) ? "border-red-400/50 bg-red-950/50 text-red-100" : "border-white/10 bg-black/35 text-slate-300"}`}>
                  <span className="block font-medium">{group.name}</span>
                  <span className="mt-1 block text-xs text-slate-400">{group.members.length} members</span>
                </button>
              ))}
            </nav>
            {(() => {
              const group = groups.find((item) => item._id === selectedGroupId) ?? groups[0];
              return (
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
                    <div><h3 className="font-semibold">{group.name}</h3><p className="mt-1 text-xs text-slate-400">Members: {group.members.join(", ")}</p></div>
                    <span className="text-xs text-red-300">Group chat</span>
                  </div>
                  <div className="my-4 max-h-80 min-h-32 space-y-3 overflow-y-auto" aria-live="polite">
                    {group.messages.length === 0 && <p className="text-sm text-slate-400">No group messages yet. Start the conversation.</p>}
                    {group.messages.map((message) => (
                      <article key={message._id} className={`max-w-[90%] rounded-2xl border px-4 py-3 ${message.senderId === userId ? "ml-auto border-red-500/25 bg-red-950/50" : "border-white/10 bg-black/50"}`}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="text-xs text-red-200">{message.senderName} · {new Date(message.createdAt).toLocaleTimeString()}</p>
                          <button type="button" onClick={() => void toggleSavedMessage("group", message._id, group._id)} disabled={savingMessageIds.includes(message._id)} aria-label={savedBySource.has(`group:${message._id}`) ? "Remove saved message" : "Save message"} className="text-xs text-red-200 transition hover:text-white disabled:opacity-50">
                            {savedBySource.has(`group:${message._id}`) ? "Saved" : "Save"}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                      </article>
                    ))}
                  </div>
                  <form onSubmit={sendGroupMessage} className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
                    <label className="sr-only" htmlFor="group-message">Message this group</label>
                    <textarea id="group-message" value={groupText} onChange={(event) => setGroupText(event.target.value)} rows={2} maxLength={2000} placeholder={`Message ${group.name}…`} className={`${field} resize-none`} />
                    <button disabled={busy || !groupText.trim()} className={`${button} sm:self-end`}>{busy ? "…" : "Send"}</button>
                  </form>
                </div>
              );
            })()}
          </div>
        )}
      </section>}
      {section === "saved" && <section className={`${panel} mt-5`}>
        <p className="text-xs uppercase tracking-[0.2em] text-red-300">YOUR LIBRARY</p>
        <h2 className="mt-1 text-xl font-semibold">Saved messages</h2>
        <p className="mt-2 text-sm text-slate-400">Saved messages stay here even after chat history expires.</p>
        <div className="mt-5 space-y-3">
          {savedMessages.length === 0 && <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">No saved messages yet. Use Save beside a message in a private or group chat.</p>}
          {savedMessages.map((message) => (
            <article key={message._id} className="rounded-2xl border border-white/10 bg-black/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-red-300">{message.sourceType === "group" ? `${message.groupName ?? "Group chat"} · ${message.senderName}` : `Private chat · ${message.senderName}`}</p>
                  <p className="mt-1 text-xs text-slate-500">Saved {new Date(message.savedAt).toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => void toggleSavedMessage(message.sourceType, message.sourceMessageId)} disabled={savingMessageIds.includes(message.sourceMessageId)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 transition hover:border-red-300/40 hover:text-white disabled:opacity-50">
                  Remove
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{message.text}</p>
            </article>
          ))}
        </div>
      </section>}
    </main>
  );
}

export function OwnerPortal() {
  const router = useRouter();
  const pushPermission = useNotificationPermission();
  const [section, navigate] = useSectionNavigation<OwnerSection>("inbox", ownerSectionIds);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [feed, setFeed] = useState<FeedMessage[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [groups, setGroups] = useState<OwnerGroup[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [userEditor, setUserEditor] = useState<ContactItem | null>(null);
  const [userEditDraft, setUserEditDraft] = useState({ name: "", username: "", password: "" });
  const [userEditBusy, setUserEditBusy] = useState(false);
  const [userCreateOpen, setUserCreateOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerCurrentPassword, setOwnerCurrentPassword] = useState("");
  const [ownerNewPassword, setOwnerNewPassword] = useState("");
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState("");
  const [ownerAccountBusy, setOwnerAccountBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const expireSession = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  }, [router]);

  const refresh = useCallback(async () => {
    const [requestResponse, feedResponse, contactResponse, groupResponse] = await Promise.all([
      fetch("/api/owner/requests", { cache: "no-store" }),
      fetch("/api/owner/feed", { cache: "no-store" }),
      fetch("/api/owner/contacts", { cache: "no-store" }),
      fetch("/api/owner/groups", { cache: "no-store" }),
    ]);
    if ([requestResponse, feedResponse, contactResponse, groupResponse].some((response) => response.status === 401)) {
      await expireSession();
      return;
    }
    if (!requestResponse.ok || !feedResponse.ok || !contactResponse.ok || !groupResponse.ok) throw new Error("Unable to refresh the owner dashboard.");
    const [requestData, feedData, contactData, groupData] = await Promise.all([requestResponse.json(), feedResponse.json(), contactResponse.json(), groupResponse.json()]);
    setRequests(requestData.requests);
    setFeed(feedData.messages);
    setContacts(contactData.contacts);
    setGroups(groupData.groups);
  }, [expireSession]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void refresh().catch((reason) => setError(reason.message));
    }, 0);
    const accountLoad = window.setTimeout(() => {
      void fetch("/api/owner/account", { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401) {
            await expireSession();
            return;
          }
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Could not load owner credentials.");
          setOwnerUsername(data.username);
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load owner credentials."));
    }, 0);
    const timer = window.setInterval(() => void refresh().catch((reason) => setError(reason.message)), 3000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearTimeout(accountLoad);
      window.clearInterval(timer);
    };
  }, [expireSession, refresh]);

  useEffect(() => {
    if (!userEditor) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setUserEditor(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [userEditor]);

  async function act(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Action failed.");
    await refresh();
  }

  async function submitReply(id: string) {
    const text = reply[id]?.trim();
    if (!text) return;
    try {
      await act(`/api/owner/requests/${id}/reply`, "POST", { reply: text });
      setReply((current) => ({ ...current, [id]: "" }));
      setNotice("Reply formatted and delivered to the contact.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reply could not be sent.");
    }
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/owner/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create the contact.");
      setNotice("User account created. Share the username and password securely.");
      setError("");
      formElement.reset();
      setUserCreateOpen(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the contact.");
    }
  }

  async function changeContact(contact: ContactItem) {
    try {
      await act("/api/owner/contacts", "PATCH", { action: "status", id: contact._id, disabled: !contact.disabled });
      setNotice(`${contact.name} is now ${contact.disabled ? "enabled" : "disabled"}.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update contact.");
    }
  }

  function openUserEditor(contact: ContactItem) {
    setUserEditor(contact);
    setUserEditDraft({ name: contact.name, username: contact.username, password: "" });
    setError("");
  }

  async function saveUserEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userEditor || userEditDraft.name.trim().length < 2 || userEditDraft.username.trim().length < 3) {
      setError("Enter a name with at least 2 characters and a username with at least 3 characters.");
      return;
    }
    if (userEditDraft.password && userEditDraft.password.length < 10) {
      setError("A new password must be at least 10 characters.");
      return;
    }
    setUserEditBusy(true);
    try {
      const response = await fetch("/api/owner/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          id: userEditor._id,
          name: userEditDraft.name,
          username: userEditDraft.username,
          ...(userEditDraft.password ? { password: userEditDraft.password } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save user changes.");
      const passwordChanged = Boolean(userEditDraft.password);
      setNotice(passwordChanged
        ? `User details saved. ${userEditor.name}'s password was updated and existing sessions were signed out.`
        : "User details saved.");
      setError("");
      setUserEditor(null);
      setUserEditDraft({ name: "", username: "", password: "" });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save user changes.");
    } finally {
      setUserEditBusy(false);
    }
  }

  async function deleteContact(contact: ContactItem) {
    if (!window.confirm(`Delete ${contact.name}'s account? They will lose access and be removed from their groups.`)) return;
    try {
      await act("/api/owner/contacts", "DELETE", { id: contact._id });
      setNotice(`${contact.name}'s account was deleted.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the account.");
    }
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (name.length < 2 || groupMemberIds.length === 0) {
      setError("Enter a group name and select at least one active, registered member.");
      return;
    }
    try {
      const response = await fetch("/api/owner/groups", {
        method: editingGroupId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingGroupId || undefined, name, memberIds: groupMemberIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save the group.");
      setGroupName("");
      setGroupMemberIds([]);
      setEditingGroupId("");
      setNotice(editingGroupId ? "Group updated." : "Group created.");
      setError("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the group.");
    }
  }

  function editGroup(group: OwnerGroup) {
    setEditingGroupId(group._id);
    setGroupName(group.name);
    setGroupMemberIds(group.memberIds);
  }

  async function deleteGroup(group: OwnerGroup) {
    if (!window.confirm(`Delete the group "${group.name}" and its messages?`)) return;
    try {
      await act("/api/owner/groups", "DELETE", { id: group._id });
      if (editingGroupId === group._id) {
        setEditingGroupId("");
        setGroupName("");
        setGroupMemberIds([]);
      }
      setNotice(`Group "${group.name}" deleted.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the group.");
    }
  }

  async function enablePush() {
    try {
      await subscribeToPush();
      setNotice("Notifications are enabled for incoming requests.");
      document.dispatchEvent(new Event("visibilitychange"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not enable notifications.");
    }
  }

  async function sendTestPush() {
    try {
      await act("/api/owner/push/test", "POST");
      setNotice("Test notification sent.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send test notification.");
    }
  }

  async function updateOwnerCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ownerNewPassword !== ownerConfirmPassword) {
      setError("New password confirmation does not match.");
      return;
    }
    setOwnerAccountBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: ownerCurrentPassword,
          username: ownerUsername,
          newPassword: ownerNewPassword,
          confirmPassword: ownerConfirmPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update owner credentials.");
      setOwnerUsername(data.username);
      setOwnerCurrentPassword("");
      setOwnerNewPassword("");
      setOwnerConfirmPassword("");
      setNotice("Owner username and password have been updated in MongoDB.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update owner credentials.");
    } finally {
      setOwnerAccountBusy(false);
    }
  }

  const contactCounts = {
    all: contacts.length,
    active: contacts.filter((contact) => contact.registered && !contact.disabled).length,
    disabled: contacts.filter((contact) => contact.registered && contact.disabled).length,
    invites: contacts.filter((contact) => !contact.registered).length,
  };
  const visibleContacts = contacts.filter((contact) => {
    const matchesSearch = `${contact.name} ${contact.username}`.toLowerCase().includes(contactSearch.trim().toLowerCase());
    const matchesFilter = contactFilter === "all" ||
      (contactFilter === "active" && contact.registered && !contact.disabled) ||
      (contactFilter === "disabled" && contact.registered && contact.disabled) ||
      (contactFilter === "invites" && !contact.registered);
    return matchesSearch && matchesFilter;
  });

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/" className="flex items-center gap-2 font-semibold tracking-[0.2em] text-red-100"><NeuralMark className="h-8 w-8" /> ADHAVAN<span className="text-red-500">.AI</span></Link><p className="mt-1 text-xs uppercase tracking-wider text-red-300">Personal AI command center</p></div>
      </header>
      <SectionNavigation
        sections={ownerSections}
        active={section}
        defaultSection="inbox"
        onNavigate={navigate}
        menuActions={[
          ...(pushPermission === "default" ? [{ id: "enable-push", label: "Enable notifications", onClick: () => void enablePush() }] : []),
          ...(pushPermission === "denied" ? [{ id: "push-blocked", label: "Notifications blocked in browser settings", onClick: () => setError("Allow notifications for this site in your browser settings, then reload the page.") }] : []),
          { id: "test-push", label: "Send test notification", onClick: () => void sendTestPush() },
          { id: "logout", label: "Log out", onClick: () => void expireSession(), danger: true },
        ]}
      />
      {notice && <p className="mb-4 rounded-xl border border-red-300/30 bg-red-950/50 p-3 text-sm text-red-100">{notice}</p>}
      {error && <ErrorText>{error}</ErrorText>}
      {section === "settings" && <details open className={`${panel} mb-5`}>
        <summary className="cursor-pointer list-none text-sm font-semibold text-red-100">
          Owner account settings <span className="ml-1 text-xs font-normal text-slate-400">Change username or password</span>
        </summary>
        <form onSubmit={updateOwnerCredentials} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-300 sm:col-span-2">Owner username
            <input value={ownerUsername} onChange={(event) => setOwnerUsername(event.target.value)} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" autoComplete="username" className={`${field} mt-2`} />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">Current password
            <input type="password" value={ownerCurrentPassword} onChange={(event) => setOwnerCurrentPassword(event.target.value)} required maxLength={128} autoComplete="current-password" className={`${field} mt-2`} />
          </label>
          <label className="block text-sm text-slate-300">New password (10+ characters)
            <input type="password" value={ownerNewPassword} onChange={(event) => setOwnerNewPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" className={`${field} mt-2`} />
          </label>
          <label className="block text-sm text-slate-300">Confirm new password
            <input type="password" value={ownerConfirmPassword} onChange={(event) => setOwnerConfirmPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" className={`${field} mt-2`} />
          </label>
          <div className="sm:col-span-2">
            <button disabled={ownerAccountBusy || !ownerCurrentPassword || ownerNewPassword.length < 10 || ownerNewPassword !== ownerConfirmPassword || ownerUsername.trim().length < 3} className={button}>
              {ownerAccountBusy ? "Saving…" : "Update owner credentials"}
            </button>
            <p className="mt-2 text-xs text-slate-500">The new password is stored as a secure hash in MongoDB. Your current session stays active.</p>
          </div>
        </form>
      </details>}
      {(section === "inbox" || section === "activity") && <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        {section === "inbox" && <section className={panel}>
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-xs uppercase tracking-[0.2em] text-red-300">ADHAVAN // INCOMING SIGNALS</p><h1 className="mt-1 text-2xl font-semibold">Your request inbox</h1></div>
            <span className="rounded-full border border-red-400/20 bg-red-950/40 px-3 py-1 text-sm text-red-200">{requests.filter((item) => item.status === "pending").length} pending</span>
          </div>
          <div className="space-y-4">
            {requests.length === 0 && <p className="text-sm text-slate-400">No requests yet. New requests will appear here.</p>}
            {requests.map((item) => (
              <article key={item._id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{item.contactName}</h2><span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-red-100">{item.status} · {item.category}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{item.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                {item.status === "pending" && (
                  <>
                    <label className="sr-only" htmlFor={`reply-${item._id}`}>Write a reply to {item.contactName}</label>
                    <textarea id={`reply-${item._id}`} value={reply[item._id] ?? ""} onChange={(event) => setReply((current) => ({ ...current, [item._id]: event.target.value }))} maxLength={4000} rows={3} placeholder="Write your reply. It will be formatted and delivered in the user's chat." className={`${field} mt-4 resize-y`} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void submitReply(item._id)} disabled={!reply[item._id]?.trim()} className={button}>Format & send</button>
                      <button onClick={() => void act(`/api/owner/requests/${item._id}/deny`, "POST").catch((reason) => setError(reason.message))} className="rounded-xl border border-red-300/25 px-4 py-3 text-sm text-red-200">Decline</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>}
        {section === "activity" && <section className={panel}>
          <p className="text-xs uppercase tracking-[0.2em] text-red-300">NEURAL ACTIVITY STREAM</p>
          <h2 className="mt-1 text-2xl font-semibold">Your live message feed</h2>
          <div className="mt-5 max-h-[75vh] space-y-3 overflow-y-auto">
            {feed.length === 0 && <p className="text-sm text-slate-400">Messages from verified contacts will appear here.</p>}
            {feed.map((message) => <article key={message._id} className="rounded-xl border border-white/10 bg-slate-950/35 p-3">
              <div className="flex justify-between gap-2"><p className="text-sm font-medium">{message.contactName} <span className="font-normal text-slate-500">· {message.role}</span></p><time className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleTimeString()}</time></div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{message.text}</p>
            </article>)}
          </div>
        </section>}
      </div>}
      {section === "users" && <section className={`${panel} mt-5`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">ACCESS DIRECTORY</p>
            <h2 className="mt-1 text-xl font-semibold">User management <span className="text-sm font-normal text-slate-400">({contacts.length})</span></h2>
            <p className="mt-1 text-xs text-slate-400">{contactCounts.active} active · {contactCounts.disabled} disabled · {contactCounts.invites} legacy invites</p>
          </div>
          <button type="button" onClick={() => setUserCreateOpen((open) => !open)} aria-expanded={userCreateOpen} className={`${button} w-full sm:w-auto`}>
            {userCreateOpen ? "Close form" : "＋ Create user"}
          </button>
        </div>
        {userCreateOpen && <form onSubmit={createContact} className="mt-4 grid gap-3 rounded-2xl border border-red-300/20 bg-black/30 p-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">Full name
            <input className={`${field} mt-1`} name="name" required minLength={2} maxLength={80} autoComplete="name" />
          </label>
          <label className="text-sm text-slate-300">Username
            <input className={`${field} mt-1`} name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" autoCapitalize="none" autoComplete="off" />
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">Initial password (10–128 characters)
            <input className={`${field} mt-1`} name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">The account is created immediately. Passwords are saved securely as hashes.</p>
          <button className={`${button} w-full sm:col-span-2`}>Create account</button>
        </form>}
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label>
            <span className="sr-only">Search users by name or username</span>
            <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} type="search" placeholder="Search name or username" className={field} />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter users">
            {([
              ["all", "All"],
              ["active", "Active"],
              ["disabled", "Disabled"],
              ["invites", "Invites"],
            ] as const).map(([filter, label]) => (
              <button key={filter} type="button" onClick={() => setContactFilter(filter)} aria-pressed={contactFilter === filter} className={`shrink-0 rounded-full border px-3 py-2 text-xs ${contactFilter === filter ? "border-red-400/50 bg-red-950/60 text-red-100" : "border-white/10 text-slate-400"}`}>
                {label} <span className="ml-1 opacity-70">{contactCounts[filter]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full table-fixed text-left">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-slate-500 sm:text-xs">
              <tr>
                <th scope="col" className="w-[53%] px-3 py-3 sm:px-4">User</th>
                <th scope="col" className="w-[20%] px-1 py-3 sm:px-3">Status</th>
                <th scope="col" className="w-[27%] px-2 py-3 sm:px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {contacts.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No users yet. Create an account to get started.</td></tr>}
              {contacts.length > 0 && visibleContacts.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No users match this search and filter.</td></tr>}
              {visibleContacts.map((contact) => {
                const status = !contact.registered ? "Invite" : contact.disabled ? "Disabled" : "Active";
                return <tr key={contact._id} className="bg-black/20">
                  <td className="px-3 py-3 sm:px-4 sm:py-4">
                    <p className="break-words text-sm font-medium text-white">{contact.name}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1">
                      <span className="truncate text-xs text-slate-400">@{contact.username}</span>
                      <button type="button" onClick={() => openUserEditor(contact)} aria-label={`Edit ${contact.name}`} title="Edit user details" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-red-300/40 hover:bg-red-950/50 hover:text-red-100">
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <path d="m12.8 3.2 4 4M3 17l3.6-.8L16.6 6.2a2.1 2.1 0 0 0-3-3L3.6 13.2 3 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{contact.lastActiveAt ? `Active ${new Date(contact.lastActiveAt).toLocaleDateString()}` : "No activity yet"}</p>
                  </td>
                  <td className="px-1 py-3 sm:px-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-medium uppercase tracking-wide sm:text-[10px] ${contact.registered && !contact.disabled ? "border-emerald-400/25 bg-emerald-950/30 text-emerald-200" : "border-amber-300/25 bg-amber-950/20 text-amber-200"}`}>{status}</span>
                  </td>
                  <td className="px-2 py-3 sm:px-3">
                    <div className="flex flex-col items-start gap-1.5">
                      {contact.registered && <button type="button" onClick={() => void changeContact(contact)} className="text-left text-[11px] text-slate-300 hover:text-white">{contact.disabled ? "Enable" : "Disable"}</button>}
                      <button type="button" onClick={() => void deleteContact(contact)} className="text-left text-[11px] text-red-300 hover:text-red-100">Delete</button>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Select the pencil beside a username to edit their name, username, or password.</p>
      </section>}
      {userEditor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setUserEditor(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="glass w-full max-w-lg rounded-3xl border border-red-300/20 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">ACCOUNT CONTROL</p>
              <h2 id="edit-user-title" className="mt-1 text-xl font-semibold">Edit user</h2>
              <p className="mt-1 text-sm text-slate-400">@{userEditor.username}</p>
            </div>
            <button type="button" onClick={() => setUserEditor(null)} aria-label="Close edit user dialog" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/5">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <form onSubmit={saveUserEditor} className="mt-5 space-y-4">
            <label className="block text-sm text-slate-300">Name
              <input value={userEditDraft.name} onChange={(event) => setUserEditDraft((draft) => ({ ...draft, name: event.target.value }))} required minLength={2} maxLength={80} autoComplete="name" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm text-slate-300">Username
              <input value={userEditDraft.username} onChange={(event) => setUserEditDraft((draft) => ({ ...draft, username: event.target.value }))} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" autoCapitalize="none" autoComplete="username" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm text-slate-300">{userEditor.registered ? "New password (optional)" : "Set password to activate account"}
              <input value={userEditDraft.password} onChange={(event) => setUserEditDraft((draft) => ({ ...draft, password: event.target.value }))} type="password" minLength={userEditDraft.password ? 10 : undefined} maxLength={128} autoComplete="new-password" placeholder="Leave blank to keep current password" className={`${field} mt-1`} />
            </label>
            <p className="text-xs leading-5 text-slate-500">{userEditDraft.password
              ? "Saving a password securely updates its hash and signs out this user on all devices."
              : "Passwords are never shown. Enter a new password only when you want to replace the current one."}</p>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setUserEditor(null)} className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200">Cancel</button>
              <button type="submit" disabled={userEditBusy || (Boolean(userEditDraft.password) && userEditDraft.password.length < 10)} className={`${button} sm:min-w-36`}>{userEditBusy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </section>
      </div>}
      {section === "groups" && <section className={`${panel} mt-5`}>
        <p className="text-xs uppercase tracking-[0.2em] text-red-300">OWNER-CONTROLLED SPACES</p>
        <h2 className="mt-1 text-xl font-semibold">Group chats</h2>
        <p className="mt-2 text-sm text-slate-400">Create groups from active, registered contacts. Members can chat together; you can view the member list and conversation.</p>
        <form onSubmit={saveGroup} className="mt-4 rounded-2xl border border-red-300/15 bg-black/30 p-4">
          <label className="block text-sm text-slate-300">Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} required minLength={2} maxLength={80} className={`${field} mt-2`} placeholder="e.g. Friends" /></label>
          <fieldset className="mt-4">
            <legend className="text-sm text-slate-300">Choose group members</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {contacts.filter((contact) => contact.registered && !contact.disabled).map((contact) => (
                <label key={contact._id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-slate-200">
                  <input type="checkbox" checked={groupMemberIds.includes(contact._id)} onChange={(event) => setGroupMemberIds((current) => event.target.checked ? [...current, contact._id] : current.filter((id) => id !== contact._id))} className="accent-red-500" />
                  <span>{contact.name} <span className="text-slate-500">@{contact.username}</span></span>
                </label>
              ))}
              {contacts.every((contact) => !contact.registered || contact.disabled) && <p className="text-sm text-slate-500">No active registered users are available to add.</p>}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={!groupName.trim() || groupMemberIds.length === 0} className={button}>{editingGroupId ? "Save group changes" : "Create group"}</button>
            {editingGroupId && <button type="button" onClick={() => { setEditingGroupId(""); setGroupName(""); setGroupMemberIds([]); }} className="rounded-xl border border-white/15 px-4 py-3 text-sm">Cancel edit</button>}
          </div>
        </form>
        <div className="mt-5 space-y-4">
          {groups.length === 0 && <p className="text-sm text-slate-400">No groups created yet.</p>}
          {groups.map((group) => (
            <article key={group._id} className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-semibold">{group.name}</h3><p className="mt-1 text-sm text-slate-400">Members ({group.members.length}): {group.members.map((member) => `${member.name} (@${member.username})`).join(", ") || "No members"}</p></div>
                <div className="flex gap-2"><button onClick={() => editGroup(group)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs">Edit group</button><button onClick={() => void deleteGroup(group)} className="rounded-full border border-red-300/30 px-3 py-1.5 text-xs text-red-200">Delete</button></div>
              </div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
                {group.messages.length === 0 && <p className="text-sm text-slate-500">No messages in this group yet.</p>}
                {group.messages.map((message) => <div key={message._id} className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                  <div className="flex justify-between gap-3"><p className="text-xs font-medium text-red-200">{message.senderName}</p><time className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</time></div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{message.text}</p>
                </div>)}
              </div>
            </article>
          ))}
        </div>
      </section>}
    </main>
  );
}
