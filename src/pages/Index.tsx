import { useState, useEffect, lazy, Suspense, memo, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Home, Users, Upload, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Navigation } from "@/components/Navigation";
import { BottomNav } from "@/components/BottomNav";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingQuestionnaire } from "@/components/OnboardingQuestionnaire";

import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTabReorder } from "@/hooks/useTabReorder";
import { ProfileEditingProvider } from "@/hooks/useProfileEditing";
import { ProfileProvider, useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedResize } from "@/lib/performance";

// Lazy load heavy components for better initial load
const Dashboard = lazy(() => import("@/components/Dashboard").then(m => ({ default: m.Dashboard })));
const OCRUpload = lazy(() => import("@/components/OCRUpload").then(m => ({ default: m.OCRUpload })));
const ScheduleScanner = lazy(() => import("@/components/ScheduleScanner").then(m => ({ default: m.ScheduleScanner })));
const Settings = lazy(() => import("@/components/Settings").then(m => ({ default: m.Settings })));
const Connect = lazy(() => import("@/components/Connect").then(m => ({ default: m.Connect })));
const AnalyticsDashboard = lazy(() => import("@/components/AnalyticsDashboard").then(m => ({ default: m.AnalyticsDashboard })));

// Loading fallback component
const PageLoader = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const IndexContent = () => {
  const [currentPage, setCurrentPage] = useState('connect');
  const [settingsTab, setSettingsTab] = useState<string>('accounts');
  const [uploadTab, setUploadTab] = useState<string>('note-digitizer');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [sidebarWidthPx, setSidebarWidthPx] = useState(240);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  
  // Initialize user preferences on app load
  usePreferences();

  // Note: localStorage persistence removed to fix collapse behavior

  // Debounced handler to save sidebar width
  const handleLayoutChange = useMemo(
    () => {
      let timeout: NodeJS.Timeout;
      return (sizes: number[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (sizes[0]) {
            setSidebarWidth(sizes[0]);
            localStorage.setItem('planverse-sidebar-width', String(sizes[0]));
          }
        }, 300);
      };
    },
    []
  );

  // Track pixel width changes with immediate initial measurement
  useEffect(() => {
    if (!sidebarRef.current) return;
    
    // Immediate measurement on mount
    const initialWidth = sidebarRef.current.getBoundingClientRect().width;
    setSidebarWidthPx(initialWidth);
    console.log('Initial sidebar width:', initialWidth);
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const newWidth = entries[0].contentRect.width;
        setSidebarWidthPx(newWidth);
        console.log('Sidebar resized to:', newWidth);
      }
    });
    
    observer.observe(sidebarRef.current);
    return () => observer.disconnect();
  }, []);

  // Handle hash navigation for integrations
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'integrations') {
        setCurrentPage('integrations');
      }
    };

    // Check initial hash
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Tab reordering functionality
  const navItems = useMemo(() => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'connect', label: 'Connect', icon: Users },
      { id: 'upload', label: 'Image Upload', icon: Upload },
    ];
    
    // Only add Analytics for professional accounts (business or creator)
    if (profile?.account_type?.startsWith('professional_')) {
      baseItems.push({ 
        id: 'analytics', 
        label: 'Analytics', 
        icon: TrendingUp 
      });
    }
    
    return baseItems;
  }, [profile?.account_type]);

  const {
    isReorderMode,
    setIsReorderMode,
    saveTabOrder,
    cancelReorder,
  } = useTabReorder(navItems);

  // Check if user needs onboarding
  useEffect(() => {
    if (!loading && user && profile) {
      setShowOnboarding(!profile.onboarding_completed);
    }
  }, [user, loading, profile]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    // Refresh profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        // Profile will be refreshed through the ProfileProvider
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        );
      case 'upload':
        return (
          <Suspense fallback={<PageLoader />}>
            <div className="p-6">
              <Tabs value={uploadTab} onValueChange={setUploadTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="note-digitizer">Note Digitizer</TabsTrigger>
                  <TabsTrigger value="schedule-scanner">Schedule Scanner</TabsTrigger>
                </TabsList>
                <TabsContent value="note-digitizer" className="mt-0">
                  <OCRUpload />
                </TabsContent>
                <TabsContent value="schedule-scanner" className="mt-0">
                  <ScheduleScanner />
                </TabsContent>
              </Tabs>
            </div>
          </Suspense>
        );
      case 'connect':
        return (
          <Suspense fallback={<PageLoader />}>
            <Connect onNavigateToAnalytics={() => setCurrentPage('analytics')} />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <Settings defaultTab={settingsTab} />
          </Suspense>
        );
      case 'analytics':
        // Only professional accounts can access analytics
        if (!profile?.account_type?.startsWith('professional_')) {
          return (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">Upgrade Required</h2>
                <p className="text-muted-foreground mb-4">
                  Switch to a Professional Account to access Analytics
                </p>
                <Button 
                  onClick={() => setCurrentPage('settings')} 
                >
                  Upgrade to Professional
                </Button>
              </div>
            </div>
          );
        }
        
        return (
          <Suspense fallback={<PageLoader />}>
            <AnalyticsDashboard />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        );
    }
  };

  return (
    <>
      {showOnboarding && <OnboardingQuestionnaire onComplete={handleOnboardingComplete} />}
      
      <ProfileEditingProvider>
        <div 
          className="flex bg-background overflow-hidden w-full" 
          style={{ 
            height: 'var(--app-height, 100vh)', 
            minHeight: 'var(--app-height, 100vh)',
            maxHeight: 'var(--app-height, 100vh)'
          }}
        >
          {/* Desktop Resizable Layout - Hidden on mobile */}
          <div className="hidden md:flex md:w-full h-full">
            <ResizablePanelGroup 
              direction="horizontal" 
              onLayout={handleLayoutChange}
              className="w-full"
            >
              <ResizablePanel 
                defaultSize={sidebarWidth} 
                minSize={12} 
                maxSize={40}
                className="h-full"
              >
                <div ref={sidebarRef} className="h-full">
                  <Navigation 
                    currentPage={currentPage} 
                    onPageChange={setCurrentPage}
                    isReorderMode={isReorderMode}
                    onToggleReorder={() => setIsReorderMode(true)}
                    onCancelReorder={cancelReorder}
                    sidebarWidth={sidebarWidth}
                  />
                </div>
              </ResizablePanel>
              
              <ResizableHandle className="w-px bg-transparent hover:bg-border hover:w-1 transition-all cursor-col-resize" />
              
              <ResizablePanel 
                defaultSize={100 - sidebarWidth}
                className="h-full"
              >
                <div 
                  className="overflow-auto w-full h-full" 
                  style={{ 
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)'
                  }}
                >
                  {renderPage()}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile Layout - Full width */}
          <div className="md:hidden flex-1 overflow-auto w-full">
            <div className="h-full pb-20">
              {renderPage()}
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <BottomNav currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </ProfileEditingProvider>
    </>
  );
};

const Index = () => {
  return (
    <ProfileProvider>
      <IndexContent />
    </ProfileProvider>
  );
};

export default Index;
