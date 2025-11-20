import "./globals.css";
import { Inter } from 'next/font/google';
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";
import ToastProvider from "../components/ToastProvider";
import UserProvider from "../components/UserProvider";
import { AccountsProvider } from "../components/AccountsProvider";
import { NetWorthProvider } from "../components/NetWorthProvider";
import DebugFetchMonitor from "../components/DebugFetchMonitor";

const inter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600'],
  variable: '--font-inter',
});

export const metadata = {
  title: {
    template: "Zentari | %s",
    default: "Zentari",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-light">
        <ToastProvider>
          <UserProvider>
            <AccountsProvider>
              <NetWorthProvider>
                <Topbar />
                <RouteTransition>{children}</RouteTransition>
                {process.env.NEXT_PUBLIC_DEBUG_MEMORY === '1' ? <DebugFetchMonitor /> : null}
              </NetWorthProvider>
            </AccountsProvider>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
