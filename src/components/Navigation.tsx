import { useState } from "react";
import { Calendar, Home, Upload, Settings, BookOpen, Target, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Navigation = ({ currentPage, onPageChange }: NavigationProps) => {
  const [notifications] = useState(3);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'upload', label: 'OCR Upload', icon: Upload },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'analytics', label: 'Time Analytics', icon: Clock },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">CourseConnect</h1>
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
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-primary rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">JS</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">John Student</p>
            <p className="text-xs text-muted-foreground truncate">Computer Science</p>
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