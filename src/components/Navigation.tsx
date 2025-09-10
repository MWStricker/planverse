import { useState } from "react";
import { Calendar, Home, Upload, Settings, BookOpen, Target, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useProfileEditing } from "@/hooks/useProfileEditing";
import { getUniversityById } from "@/data/universities";

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Navigation = ({ currentPage, onPageChange }: NavigationProps) => {
  const [notifications] = useState(3);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { liveEditedProfile } = useProfileEditing();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'upload', label: 'Image Upload', icon: Upload },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'analytics', label: 'Time Analytics', icon: Clock },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="p-4 pt-2 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 overflow-hidden rounded-lg mt-1">
            <img 
              src="/lovable-uploads/a3ff9ac9-6bac-424f-a880-22b8b42de5c3.png" 
              alt="CourseConnect Logo" 
              className="w-16 h-16 object-cover object-center scale-125"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Course Connect</h1>
            <p className="text-xs text-muted-foreground">Smart Scheduling</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start h-11 transition-all ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onPageChange(item.id)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
              {item.id === 'tasks' && notifications > 0 && (
                <Badge 
                  className="ml-auto bg-accent text-accent-foreground text-xs"
                  variant="secondary"
                >
                  {notifications}
                </Badge>
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {liveEditedProfile.display_name || profile?.display_name || user?.email?.split('@')[0] || 'User'}
              </p>
              {(() => {
                const currentSchool = liveEditedProfile.school || profile?.school;
                const university = currentSchool ? getUniversityById(currentSchool) : null;
                return university?.logo ? (
                  <img 
                    src={university.logo} 
                    alt={university.shortName} 
                    className="w-6 h-6 object-contain"
                  />
                ) : null;
              })()}
            </div>
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
          <Button variant="ghost" size="sm" className="flex-1">
            <Bell className="h-4 w-4 mr-2" />
            Alerts
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onPageChange('settings')}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};