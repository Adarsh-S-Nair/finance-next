import "./globals.css";
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";
import ToastProvider from "../components/ToastProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Topbar />
          <RouteTransition>{children}</RouteTransition>
        </ToastProvider>
      </body>
    </html>
  );
}
