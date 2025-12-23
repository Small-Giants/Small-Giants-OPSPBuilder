"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUpIcon, FileTextIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdminPanel from "@/components/AdminPanel";
import IndividualRocks from "@/components/IndividualRocks";
import YearSwitcher from "@/components/YearSwitcher";
import Breadcrumbs from "@/components/Breadcrumbs";

// Components
import NavigationSidebar from "@/components/NavigationSidebar";
import OpspCanvas from "@/components/OpspCanvas";
import PriorityTracker from "@/components/PriorityTracker";
import PriorityManagement from "@/components/PriorityManagement";
import MetricsDashboard from "@/components/MetricsDashboard";
import AgileGrowthChecklist from "@/components/AgileGrowthChecklist";
import SwotMatrix from "@/components/SwotMatrix";
import PersonalDevelopment from "@/components/PersonalDevelopment";
import RocksPage from "@/components/RocksPage";
import StagesOfGrowthModal from "@/components/StagesOfGrowthModal";
import Foundation from "@/components/Foundation";
import ThreeYear from "@/components/ThreeYear";
import OneYear from "@/components/OneYear";
import Settings from "@/components/Settings";
import JustGetItDone from "@/components/JustGetItDone";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import WeeklyMeeting from "@/components/WeeklyMeeting";
import PlanningWizard from "@/components/PlanningWizard";
import ExportModal from "@/components/ExportModal";

export default function MainApp() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState('exec-summary');
  const [showTechOverlay, setShowTechOverlay] = useState(true);
  const [showStagesModal, setShowStagesModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Futuristic animation effect
  useEffect(() => {
    const timer = setTimeout(() => setShowTechOverlay(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Navigation handler - memoized for use in event listeners
  const handleNavigate = useCallback((itemId: string) => {
    setCurrentView(itemId);
  }, []);

  // Listen for navigation events from child components (e.g., ScalabilityRoadmap)
  useEffect(() => {
    const handleNavigateEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleNavigate(customEvent.detail);
      }
    };
    window.addEventListener('navigate', handleNavigateEvent);
    return () => window.removeEventListener('navigate', handleNavigateEvent);
  }, [handleNavigate]);

  const handleExportPDF = () => {
    setShowExportModal(true);
  };

  const renderMainContent = () => {
    switch (currentView) {
      case 'exec-summary':
        return <ExecutiveSummary onNavigate={handleNavigate} />;
      case 'wizard':
        return <PlanningWizard onNavigate={handleNavigate} />;
      case 'foundation':
        return <Foundation />;
      case 'three-year':
        return <ThreeYear />;
      case 'one-year':
        return <OneYear />;
      case 'priorities':
        return (
          <PriorityTracker />
        );
      case 'priority-management':
        return <PriorityManagement />;
      case 'metrics':
        return (
          <MetricsDashboard />
        );
      case 'assessments':
        return <AgileGrowthChecklist />;
      case 'swot':
        return (
          <SwotMatrix />
        );
      case 'just-get-it-done':
        return <JustGetItDone />;
      case 'personal':
        return (
          <PersonalDevelopment />
        );
      case 'rocks':
        return (
          <RocksPage
            currentUserId={user?.uid}
            currentUserName={user?.name || user?.email?.split('@')[0] || 'Guest'}
          />
        );
      case 'my-rocks':
        return <IndividualRocks />;
      case 'capabilities':
        return (
          <PriorityTracker
            isCapabilityView={true}
          />
        );
      case 'admin':
        return <AdminPanel />;
      case 'settings':
        return <Settings />;
      case 'weekly-meeting':
        return <WeeklyMeeting />;
      default:
        return (
          <OpspCanvas />
        );
    }
  };

  return (
    <>
      {showTechOverlay && (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}
        <div className="flex h-screen bg-background">
          <NavigationSidebar
            currentUser={user ? {
              name: user.name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              avatar: undefined,
              role: user.role
            } : undefined}
            activeItemId={currentView}
            onNavigate={handleNavigate}
            onLogout={logout}
          />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm">
              <div className="flex items-center justify-between h-full px-6 gap-4">
                <div className="flex items-center gap-4">
                  <Breadcrumbs currentView={currentView} />
                  <YearSwitcher />
                </div>
                
                {/* Stages of Growth Card - TODO: Make stage dynamic from company settings */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="transition-all cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setShowStagesModal(true)}
                    data-testid="button-stages-of-growth"
                  >
                    <TrendingUpIcon className="w-4 h-4 mr-1.5 text-accent" />
                    <span className="text-xs">Stages of Growth</span>
                  </Button>
                  
                  <div className="h-4 w-px bg-border" />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    data-testid="button-export-pdf"
                  >
                    <FileTextIcon className="w-4 h-4 mr-1.5" />
                    Export
                  </Button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6">
              {renderMainContent()}
            </main>
          </div>
        </div>
        <StagesOfGrowthModal 
          open={showStagesModal}
          onOpenChange={setShowStagesModal}
        />
        <ExportModal
          open={showExportModal}
          onOpenChange={setShowExportModal}
        />
    </>
  );
}
