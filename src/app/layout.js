import "./globals.css";
import { Outfit, Poppins, Inter } from 'next/font/google';
import Topbar from "../components/layout/Topbar";
import ToastProvider from "../components/providers/ToastProvider";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import UserProvider from "../components/providers/UserProvider";
import { AccountsProvider } from "../components/providers/AccountsProvider";
import { NetWorthProvider } from "../components/providers/NetWorthProvider";
import DebugFetchMonitor from "../components/DebugFetchMonitor";
import DynamicFavicon from "../components/DynamicFavicon";


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

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata = {
  title: {
    template: "Zervo | %s",
    default: "Zervo",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${poppins.variable} ${inter.variable}`}>
      <body className="font-light selection:bg-zinc-900 selection:text-white">
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
