import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Calendar as CalendarIcon, Home, Upload, Target, Users, BookOpen } from "lucide-react";

import { Dashboard } from "@/components/Dashboard";
import { OCRUpload } from "@/components/OCRUpload";
import { ScheduleScanner } from "@/components/ScheduleScanner";
import { Navigation } from "@/components/Navigation";
import { Settings } from "@/components/Settings";
import { IntegrationSetup } from "@/components/IntegrationSetup";
import Calendar from "@/components/Calendar";
import { Connect } from "@/components/Connect";
import { Tasks } from "@/components/Tasks";
import { Courses } from "@/components/Courses";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTabReorder } from "@/hooks/useTabReorder";
import { ProfileEditingProvider } from "@/hooks/useProfileEditing";
import { ProfileProvider } from "@/hooks/useProfile";

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>('accounts');
  const [uploadTab, setUploadTab] = useState<string>('note-digitizer');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Initialize user preferences on app load
  usePreferences();

  // Auto-collapse sidebar when on calendar page with smooth transitions
  // On mobile, always start collapsed
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (currentPage === 'calendar' || isMobile) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [currentPage]);

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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
        return <Dashboard />;
      case 'upload':
        return (
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
        );
      case 'connect':
        return <Connect />;
      case 'settings':
        return <Settings defaultTab={settingsTab} />;
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
        return <Dashboard />;
    }
  };

  return (
    <ProfileProvider>
      <ProfileEditingProvider>
      <div 
        className="flex bg-background overflow-hidden" 
        style={{ 
          height: 'var(--app-height, 100vh)', 
          minHeight: 'var(--app-height, 100vh)',
          maxHeight: 'var(--app-height, 100vh)'
        }}
      >
        {/* Mobile: Always collapsed sidebar that slides in/out */}
        <div 
          className={`
            md:flex-shrink-0 h-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform
            ${isCollapsed ? 'w-16' : 'w-64'}
            max-md:fixed max-md:top-0 max-md:left-0 max-md:z-40 max-md:shadow-lg
            ${!isCollapsed ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
          `}
          style={{ 
            contain: 'layout style paint',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden'
          }}
        >
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
        
        {/* Mobile: Backdrop when sidebar is open */}
        {!isCollapsed && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsCollapsed(true)}
          />
        )}
        
        {/* Mobile: Menu button when sidebar is collapsed */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-background border border-border rounded-lg shadow-lg hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        
        <div 
          className="flex-1 overflow-auto scroll-performance transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform w-full" 
          style={{ 
            height: 'var(--app-height, 100vh)',
            maxHeight: 'var(--app-height, 100vh)'
          }}
        >
          {renderPage()}
        </div>
      </div>
      </ProfileEditingProvider>
    </ProfileProvider>
  );
};

export default Index;
