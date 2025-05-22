import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_10px,#e5e7eb_10px,#e5e7eb_20px)] text-gray-900">
        <div className="relative min-h-screen flex">
          <Sidebar />

          {/* Área principal com Navbar e conteúdo */}
          <main className="flex-1 p-6 bg-white border-l border-gray-300 rounded-l-xl shadow-xl m-4 relative z-10">
            <Navbar />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
