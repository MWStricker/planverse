import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dashboard } from "@/components/Dashboard";
import { OCRUpload } from "@/components/OCRUpload";
import { Navigation } from "@/components/Navigation";
import { Settings } from "@/components/Settings";
import { IntegrationSetup } from "@/components/IntegrationSetup";
import Calendar from "@/components/Calendar";
import { Tasks } from "@/components/Tasks";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { ProfileEditingProvider } from "@/hooks/useProfileEditing";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Initialize user preferences on app load
  usePreferences();

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
      case 'tasks':
        return <Tasks />;
      case 'courses':
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
          <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
        <div className="flex-1 overflow-auto relative">
          <Button 
            className="fixed top-4 right-4 z-50 bg-black text-white hover:bg-gray-800 border border-white"
            onClick={() => setCurrentPage('tasks')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
          {renderPage()}
        </div>
      </div>
    </ProfileEditingProvider>
  );
};

export default Index;
