import { Providers } from "./component/Providers";
import { ToastProvider } from "./component/ToastProvider";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
          {children}
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}