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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${instrumentSans.variable} ${GeistSans.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: oauthRedirectScript }} />
      </head>
      <body className="font-normal selection:bg-zinc-900 selection:text-white">
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
