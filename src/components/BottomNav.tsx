import { useState, useMemo } from "react";
import { Home, Users, Upload, Settings, User, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { ProfilePage } from "./ProfilePage";

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const BottomNav = ({ currentPage, onPageChange }: BottomNavProps) => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navItems = useMemo(() => {
    const baseItems = [
      { id: 'dashboard', icon: Home, label: 'Dashboard' },
      { id: 'connect', icon: Users, label: 'Connect' },
      { id: 'upload', icon: Upload, label: 'Upload' },
      { id: 'settings', icon: Settings, label: 'Settings' },
    ];
    
    // Insert Analytics before Settings for professional accounts
    if (profile?.account_type === 'professional') {
      baseItems.splice(3, 0, { 
        id: 'analytics', 
        icon: TrendingUp, 
        label: 'Analytics' 
      });
    }
    
    return baseItems;
  }, [profile?.account_type]);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg md:hidden safe-area-bottom">
        <nav className="flex items-center justify-around h-16 px-1">
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
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-b-full" />
                )}
                
                {/* Icon */}
                <div className={`flex items-center justify-center transition-all duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}>
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              </button>
            );
          })}

          {/* Profile Avatar Button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-200"
            aria-label="Profile"
          >
            <Avatar className="h-7 w-7 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-xs">
                {profile?.display_name?.charAt(0)?.toUpperCase() || 
                 user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </button>
        </nav>
      </div>

      {/* Profile Modal */}
      <ProfilePage 
        open={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
      />
    </>
  );
};
