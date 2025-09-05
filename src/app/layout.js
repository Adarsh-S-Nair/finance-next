import "./globals.css";
import RouteTransition from "../components/RouteTransition";
import Topbar from "../components/Topbar";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Topbar />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
