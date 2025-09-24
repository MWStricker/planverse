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
  useEffect(() => {
    if (currentPage === 'calendar') {
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
        <div 
          className={`flex-shrink-0 h-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
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
        <div 
          className="flex-1 overflow-auto scroll-performance transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform" 
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
