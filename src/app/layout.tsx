import { PermissionProvider } from "./component/PermissionProvider";
import { Providers } from "./component/Providers";
import { ToastProvider } from "./component/ToastProvider";
import "./globals.css";
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            <PermissionProvider> {/* 🚀 Bọc ở đây */}
              {children}
            </PermissionProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}