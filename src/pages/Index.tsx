import { useState, useEffect, lazy, Suspense, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Home, Users, Upload } from "lucide-react";

import { Navigation } from "@/components/Navigation";
import { BottomNav } from "@/components/BottomNav";
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

// Loading fallback component
const PageLoader = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const IndexContent = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('accounts');
  const [uploadTab, setUploadTab] = useState<string>('note-digitizer');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  
  // Initialize user preferences on app load
  usePreferences();

  // Auto-collapse sidebar with debounced resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (currentPage === 'calendar' || isMobile) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    
    handleResize();
  }, [currentPage]);

  // Debounced resize handler for performance
  useDebouncedResize(() => {
    const isMobile = window.innerWidth < 768;
    setIsCollapsed(currentPage === 'calendar' || isMobile);
  }, 150);

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
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'connect', label: 'Connect', icon: Users },
    { id: 'upload', label: 'Image Upload', icon: Upload },
  ];

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
            <Connect />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <Settings defaultTab={settingsTab} />
          </Suspense>
        );
      case 'analytics':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon</h2>
              <p className="text-muted-foreground">
                {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)} feature is in development
              </p>
            </div>
          </div>
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
          className="flex bg-background overflow-hidden" 
          style={{ 
            height: 'var(--app-height, 100vh)', 
            minHeight: 'var(--app-height, 100vh)',
            maxHeight: 'var(--app-height, 100vh)'
          }}
        >
          {/* Desktop Sidebar - Hidden on mobile */}
          <div className="hidden md:block md:flex-shrink-0 h-full transition-all duration-500">
            <Navigation 
              currentPage={currentPage} 
              onPageChange={setCurrentPage}
              isReorderMode={isReorderMode}
              onToggleReorder={() => setIsReorderMode(true)}
              onCancelReorder={cancelReorder}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
          
          {/* Main Content - Full width on mobile */}
          <div 
            className="flex-1 overflow-auto w-full" 
            style={{ 
              height: 'var(--app-height, 100vh)',
              maxHeight: 'var(--app-height, 100vh)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            <div className="h-full md:h-auto pb-20 md:pb-0">
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
