import Link from "next/link";

function NeuralMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 48 48" fill="none">
      <path d="M24 5 41 15v18L24 43 7 33V15L24 5Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
      <path d="M24 5v12m17-2-10 6m10 12-10-6M24 43V31M7 33l10-6M7 15l10 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AccessIcon({ owner = false }: { owner?: boolean }) {
  return owner ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M12 3 19 6v5c0 4.5-2.9 8-7 10-4.1-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c.7-3.3 3.2-5 7-5s6.3 1.7 7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden px-4 py-4 text-white sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <nav className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-3 sm:rounded-full sm:px-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-[.12em] text-red-100 sm:gap-3 sm:tracking-[.2em]">
            <NeuralMark className="ai-mark h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span>ADHAVAN<span className="ml-1 text-red-500 sm:ml-2">.AI</span></span>
          </Link>
          <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
            <Link href="/login" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/35 px-3 py-2 text-xs text-red-100 transition hover:bg-red-500/15 sm:flex-none sm:px-4 sm:text-sm"><AccessIcon /> Contact login</Link>
            <Link href="/owner/login" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-medium shadow-lg shadow-red-950/50 transition hover:bg-red-500 sm:flex-none sm:px-4 sm:text-sm"><AccessIcon owner /> Owner login</Link>
          </div>
        </nav>
        <section className="flex flex-col items-center justify-center py-8 sm:py-16 lg:py-20">
          <div className="w-full max-w-4xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[.2em] text-red-100 sm:text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_#ff332b]" /> ADHAVAN&apos;S PRIVATE AI NETWORK
            </p>
            <h1 className="red-glow mx-auto max-w-3xl text-[2.4rem] font-semibold leading-[0.96] tracking-tight text-white sm:text-5xl lg:text-7xl">Your circle asks.<br /><span className="text-red-500">Your AI<br className="sm:hidden" /> connects.</span></h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-red-50/80 sm:mt-6 sm:text-lg sm:leading-8">A personal command center built for ADHAVAN. Verified contacts can reach your assistant; anything needing your call gets routed to you for a direct, personal reply.</p>
          </div>
          <div className="ai-visual mt-8 w-full max-w-4xl sm:mt-10" aria-hidden="true">
            <div className="ai-visual-grid" />
            <div className="ai-orbit ai-orbit-outer" />
            <div className="ai-orbit ai-orbit-middle" />
            <div className="ai-orbit ai-orbit-inner" />
            <div className="ai-core"><NeuralMark className="ai-mark h-16 w-16 sm:h-20 sm:w-20" /></div>
            <div className="ai-signal ai-signal-left"><span className="signal-glyph">✳</span><span>UNDERSTAND</span></div>
            <div className="ai-signal ai-signal-right"><span className="signal-glyph">⌘</span><span>CONNECT</span></div>
            <div className="ai-signal ai-signal-bottom"><span className="signal-glyph">↗</span><span>YOUR RESPONSE</span></div>
            <span className="ai-node ai-node-one" />
            <span className="ai-node ai-node-two" />
            <span className="ai-node ai-node-three" />
          </div>
          <div className="mt-2 grid w-full max-w-3xl grid-cols-3 gap-2 sm:mt-4 sm:gap-4">
            <div className="ai-capability"><span className="capability-icon">◈</span><span>Private by design</span></div>
            <div className="ai-capability"><span className="capability-icon">⌁</span><span>Smart request routing</span></div>
            <div className="ai-capability"><span className="capability-icon">✧</span><span>Your voice, delivered</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
