import { Home, Users, Upload } from "lucide-react";

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const BottomNav = ({ currentPage, onPageChange }: BottomNavProps) => {
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'connect', icon: Users, label: 'Connect' },
    { id: 'upload', icon: Upload, label: 'Upload' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg md:hidden">
      <nav className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative ${
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={item.label}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full" />
              )}
              
              {/* Icon with background */}
              <div className={`flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
                isActive 
                  ? 'bg-primary/10 scale-110' 
                  : 'hover:bg-muted/50'
              }`}>
                <Icon className={`transition-all duration-200 ${
                  isActive ? 'h-6 w-6' : 'h-5 w-5'
                }`} />
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
