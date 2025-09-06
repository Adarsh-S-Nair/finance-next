import "./globals.css";
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";
import ToastProvider from "../components/ToastProvider";
import UserProvider from "../components/UserProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <UserProvider>
            <Topbar />
            <RouteTransition>{children}</RouteTransition>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
