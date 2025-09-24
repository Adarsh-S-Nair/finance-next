import "./globals.css";
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";
import ToastProvider from "../components/ToastProvider";
import UserProvider from "../components/UserProvider";
import { AccountsProvider } from "../components/AccountsProvider";
import { NetWorthProvider } from "../components/NetWorthProvider";

export const metadata = {
  title: {
    template: "Zentari | %s",
    default: "Zentari",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <UserProvider>
            <AccountsProvider>
              <NetWorthProvider>
                <Topbar />
                <RouteTransition>{children}</RouteTransition>
              </NetWorthProvider>
            </AccountsProvider>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
