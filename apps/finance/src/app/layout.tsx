import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Outfit, Poppins, Instrument_Sans } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import ToastProvider from "../components/providers/ToastProvider";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import UserProvider from "../components/providers/UserProvider";
import { AccountsProvider } from "../components/providers/AccountsProvider";
import HouseholdsProvider from "../components/providers/HouseholdsProvider";
import { NetWorthProvider } from "../components/providers/NetWorthProvider";
import QueryProvider from "../components/providers/QueryProvider";
import DebugFetchMonitor from "../components/DebugFetchMonitor";
import DynamicFavicon from "../components/DynamicFavicon";
import { BRAND } from "../config/brand";


const outfit = Outfit({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

// Modern, slightly-condensed display sans — used for the landing hero.
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument',
});


export const metadata: Metadata = {
  title: {
    template: `${BRAND.name} | %s`,
    default: BRAND.name,
  },
};

// Runs synchronously during HTML parsing — before React hydrates or the
// landing page can paint. If Supabase OAuth redirects the user back to
// `/?code=...` (which happens when the Site URL is used as the fallback),
// we forward straight to the exchange handler so the user goes directly
// from Google to the light-mode auth loading screen, with no landing flash.
const oauthRedirectScript = `
(function(){try{
  if (location.pathname !== '/') return;
  var p = new URLSearchParams(location.search);
  var code = p.get('code');
  if (!code) return;
  location.replace('/auth/callback/exchange?code=' + encodeURIComponent(code) + '&next=/dashboard');
}catch(e){}})();
`;

// Runs synchronously during HTML parsing — before first paint — to kill the
// flash of light theme on load/refresh for returning users. Reads the cached
// preference written by ThemeProvider (DB is still the source of truth; this is
// just a fast-path mirror) and applies it the same way applyThemeToDocument
// does: data-theme + the legacy `.dark` class + native color-scheme.
//
// Public/auth screens are always light (mirrors UserProvider's isPublic gate),
// so we skip them. The dark-family id list is hard-coded here because this
// inline script can't import the THEMES registry — keep it in sync with
// config/themes.js.
const themeBootScript = `
(function(){try{
  var path = location.pathname;
  if (path === '/' || path.indexOf('/auth') === 0) return;
  var root = document.documentElement;
  var t = localStorage.getItem('zervo.theme');
  if (t) {
    var isDark = (t === 'dim' || t === 'dark' || t === 'cottage');
    root.setAttribute('data-theme', t);
    if (isDark) root.classList.add('dark');
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }
  var a = localStorage.getItem('zervo.accent');
  if (a) {
    root.style.setProperty('--color-accent', a);
    root.style.setProperty('--color-accent-hover', a);
    root.style.setProperty('--color-on-accent', '#ffffff');
  }
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${instrumentSans.variable} ${GeistSans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: oauthRedirectScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-normal">
        <DynamicFavicon />
        <QueryProvider>
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <UserProvider>
                  <AccountsProvider>
                <NetWorthProvider>
                  <HouseholdsProvider>
                  {children}
                  {process.env.NEXT_PUBLIC_DEBUG_MEMORY === '1' ? <DebugFetchMonitor /> : null}
                  </HouseholdsProvider>
                </NetWorthProvider>
                  </AccountsProvider>
                </UserProvider>
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
