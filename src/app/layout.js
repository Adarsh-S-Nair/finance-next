import "./globals.css";
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";
import ToastProvider from "../components/ToastProvider";
import UserProvider from "../components/UserProvider";
import { AccountsProvider } from "../components/AccountsProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <UserProvider>
            <AccountsProvider>
              <Topbar />
              <RouteTransition>{children}</RouteTransition>
            </AccountsProvider>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
