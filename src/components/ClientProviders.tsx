"use client";

import React from "react";
import { AuthProvider } from "@/app/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import LayoutContent from "@/components/layout/LayoutContent";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <LayoutContent>{children}</LayoutContent>
      </ToastProvider>
    </AuthProvider>
  );
}
