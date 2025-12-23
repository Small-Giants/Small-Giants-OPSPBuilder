"use client";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { EditModeProvider } from "@/contexts/EditModeContext";
import { PlanYearProvider } from "@/contexts/PlanYearContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PlanYearProvider>
          <EditModeProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </EditModeProvider>
        </PlanYearProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
