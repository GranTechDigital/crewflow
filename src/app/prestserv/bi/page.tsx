"use client";

import React from "react";
import { ChartPieIcon } from "@heroicons/react/24/outline";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PROTECTION } from "@/lib/permissions";

export default function BIPage() {
  return (
    <ProtectedRoute requiredPermissions={ROUTE_PROTECTION.PRESTSERV.requiredPermissions}>
      <BIPageContent />
    </ProtectedRoute>
  );
}

function BIPageContent() {
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header Compacto */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ChartPieIcon className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Business Intelligence
              </h1>
              <p className="text-gray-500 text-sm">
                Dashboard analítico em tempo real
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Power BI Integration
          </div>
        </div>
      </div>

      {/* BI Dashboard - Ocupa todo o espaço restante */}
      <div className="flex-1 bg-white">
        <iframe
          title="Uptime Dashboard"
          width="100%"
          height="100%"
          src="https://app.powerbi.com/view?r=eyJrIjoiNGU5MjFmNWUtNTNjZi00ZTMxLWI0NmUtODgwM2QyZTc5YzMyIiwidCI6ImNhNmEwZTdiLTUzZTktNDNjMi04YTkyLTVmNzkyZDY4ZWMwNCJ9"
          frameBorder="0"
          allowFullScreen={true}
          // className="w-full h-full"
        />
      </div>
    </div>
  );
}