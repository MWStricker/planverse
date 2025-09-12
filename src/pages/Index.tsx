import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Calendar as CalendarIcon, Home, Upload, Target, Users, BookOpen } from "lucide-react";

import { Dashboard } from "@/components/Dashboard";
import { OCRUpload } from "@/components/OCRUpload";
import { Navigation } from "@/components/Navigation";
import { Settings } from "@/components/Settings";
import { IntegrationSetup } from "@/components/IntegrationSetup";
import Calendar from "@/components/Calendar";
import { Connect } from "@/components/Connect";
import { Tasks } from "@/components/Tasks";
import { Courses } from "@/components/Courses";

import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTabReorder } from "@/hooks/useTabReorder";
import { ProfileEditingProvider } from "@/hooks/useProfileEditing";

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Initialize user preferences on app load
  usePreferences();

  // Tab reordering functionality
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'connect', label: 'Connect', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: Target },
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
        return <OCRUpload />;
      case 'integrations':
        return <IntegrationSetup />;
      case 'settings':
        return <Settings />;
      case 'calendar':
        return <Calendar />;
      case 'connect':
        return <Connect />;
      case 'tasks':
        return <Tasks />;
      case 'courses':
        return <Courses />;
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
    <ProfileEditingProvider>
      <div className="flex h-screen bg-background">
        <div className="w-64 flex-shrink-0">
          <Navigation 
            currentPage={currentPage} 
            onPageChange={setCurrentPage}
            isReorderMode={isReorderMode}
            onToggleReorder={() => setIsReorderMode(true)}
            onSaveOrder={saveTabOrder}
            onCancelReorder={cancelReorder}
          />
        </div>
        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </div>
    </ProfileEditingProvider>
  );
};

export default Index;
