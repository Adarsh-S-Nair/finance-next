import Button from "../components/Button";

export default function Home() {
  return (
    <main className="gradient-hero bg-grid">
      <section className="container mx-auto px-6 pt-28 pb-28 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">
          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]"></span>
          Launching new finance features
        </div>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Finance that feels effortless
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-[var(--color-muted)]">
          Streamline your money workflows with a modern finance suite. Built for
          teams who value clarity, speed, and a clean, minimal interface.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button>
            Get started free
          </Button>
          <Button variant="secondary">
            Book a demo
          </Button>
        </div>

        <p className="mt-3 text-xs text-[var(--color-muted)]">
          No credit card required · Free 14‑day trial
        </p>
      </section>
    </main>
  );
}
