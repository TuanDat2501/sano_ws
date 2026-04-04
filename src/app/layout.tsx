import { Providers } from "./component/Providers";
import { ToastProvider } from "./component/ToastProvider";
import "./globals.css";
export const dynamic = 'force-dynamic'
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