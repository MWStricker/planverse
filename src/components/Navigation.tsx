import { useState } from "react";
import { Calendar, Home, Upload, Settings, BookOpen, Target, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useProfileEditing } from "@/hooks/useProfileEditing";
import { getUniversityById } from "@/data/universities";
import { AnalogClock } from "@/components/AnalogClock";

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Navigation = ({ currentPage, onPageChange }: NavigationProps) => {
  const [notifications] = useState(0);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { liveEditedProfile } = useProfileEditing();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'upload', label: 'Image Upload', icon: Upload },
    { id: 'courses', label: 'Courses', icon: BookOpen },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="p-4 pt-1 border-b border-border">
        <div className="flex justify-center items-center">
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">Course Connect</h1>
            <p className="text-xs text-muted-foreground">Smart Scheduling</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start h-14 text-base transition-all duration-200 ease-out group relative overflow-hidden ${
                isActive 
                  ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg scale-[1.02] border-l-4 border-l-primary-foreground/20' 
                  : 'text-foreground hover:bg-muted/30 hover:scale-[1.01]'
              }`}
              onClick={() => onPageChange(item.id)}
            >
              {/* Shimmer effect for active items */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
              )}
              
              <Icon className={`h-5 w-5 mr-3 transition-all duration-200 ease-out ${
                isActive 
                  ? 'text-primary-foreground scale-110' 
                  : 'group-hover:scale-105'
              }`} />
              <span className={`font-medium transition-all duration-150 ease-out ${
                isActive ? 'tracking-wide' : ''
              }`}>
                {item.label}
              </span>
              {item.id === 'tasks' && notifications > 0 && (
                <Badge 
                  className="ml-auto bg-gradient-to-r from-accent to-accent/80 text-accent-foreground text-xs animate-pulse shadow-sm"
                  variant="secondary"
                >
                  {notifications}
                </Badge>
              )}
              
              {/* Glow effect for active items */}
              {isActive && (
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 blur-sm -z-10 transition-all duration-300 ease-out"></div>
              )}
            </Button>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 
               user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {liveEditedProfile.display_name || profile?.display_name || user?.email?.split('@')[0] || 'User'}
              </p>
            <p className="text-xs text-muted-foreground truncate">
              {(() => {
                const currentMajor = liveEditedProfile.major || profile?.major;
                if (!currentMajor) return 'Student';
                
                // Format predefined majors with proper capitalization
                return currentMajor.includes('-') ? 
                  currentMajor.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                  currentMajor;
              })()}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200 ease-out group"
          >
            <Bell className="h-4 w-4 mr-2 transition-all duration-200 ease-out" />
            <span className="transition-all duration-150 ease-out">Alerts</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onPageChange('settings')}
            className="hover:bg-muted/30 hover:scale-[1.05] transition-all duration-200 ease-out group"
          >
            <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300 ease-out" />
          </Button>
        </div>
        
        {/* Digital Clock */}
        <div className="mt-3">
          <AnalogClock />
        </div>
      </div>
    </div>
  );
};