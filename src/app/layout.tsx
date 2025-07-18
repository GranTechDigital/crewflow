import "./globals.css";
import { AuthProvider } from "@/app/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import LayoutContent from "@/components/layout/LayoutContent";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning={true}>
      <body className="antialiased bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_10px,#e5e7eb_10px,#e5e7eb_20px)] text-gray-900">
        <AuthProvider>
          <ToastProvider>
            <LayoutContent>{children}</LayoutContent>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
