import "./globals.css";
import { Outfit, Poppins, Instrument_Sans } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import Topbar from "../components/layout/Topbar";
import ToastProvider from "../components/providers/ToastProvider";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import UserProvider from "../components/providers/UserProvider";
import { AccountsProvider } from "../components/providers/AccountsProvider";
import { NetWorthProvider } from "../components/providers/NetWorthProvider";
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


export const metadata = {
  title: {
    template: `${BRAND.name} | %s`,
    default: BRAND.name,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${instrumentSans.variable} ${GeistSans.variable}`}>
      <body className="font-normal selection:bg-zinc-900 selection:text-white">
        <DynamicFavicon />
        <ToastProvider>
          <ThemeProvider>
            <AuthProvider>
              <UserProvider>
                <AccountsProvider>
              <NetWorthProvider>
                <Topbar />
                {children}
                {process.env.NEXT_PUBLIC_DEBUG_MEMORY === '1' ? <DebugFetchMonitor /> : null}
              </NetWorthProvider>
                </AccountsProvider>
              </UserProvider>
            </AuthProvider>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
