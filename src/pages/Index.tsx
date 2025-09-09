import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { OCRUpload } from "@/components/OCRUpload";
import { Navigation } from "@/components/Navigation";
import { IntegrationSetup } from "@/components/IntegrationSetup";

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'upload':
        return <OCRUpload />;
      case 'integrations':
        return <IntegrationSetup />;
      case 'calendar':
      case 'tasks':
      case 'courses':
      case 'analytics':
      case 'settings':
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
    <div className="flex h-screen bg-background">
      <div className="w-64 flex-shrink-0">
        <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      </div>
      <div className="flex-1 overflow-auto">
        {renderPage()}
      </div>
    </div>
  );
};

export default Index;
