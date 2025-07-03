import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_10px,#e5e7eb_10px,#e5e7eb_20px)] text-gray-900">
        <ToastProvider>
          <div className="relative h-screen overflow-hidden">
            <div className="flex h-full">
              <Sidebar />
              {/* Área principal com Navbar e conteúdo */}
              <main className="flex-1 bg-white border-l border-gray-300 rounded-l-xl shadow-xl m-4 relative z-10 overflow-auto">
                <Navbar />
                <div className="p-2">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
