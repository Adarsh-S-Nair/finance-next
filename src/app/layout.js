import "./globals.css";
import ThemeToggle from "../components/ThemeToggle";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-20 w-full bg-[var(--color-bg)]/70 backdrop-blur">
          <div className="container mx-auto flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-fg)] text-[var(--color-on-primary)]">ƒ</span>
              <span className="font-semibold">Crate Finance</span>
            </div>
            <nav className="flex items-center gap-3">
              <ThemeToggle />
              <a className="inline-flex rounded-md bg-[var(--color-fg)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]" href="#login">Login</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
