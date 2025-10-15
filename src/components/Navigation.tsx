import { useState, useEffect } from "react";
import { Calendar, Home, Upload, Settings, Target, Bell, Users, BookOpen, ChevronRight, X, MoreVertical, ChevronLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useProfileEditing } from "@/hooks/useProfileEditing";
import { getUniversityById } from "@/data/universities";
import { AnalogClock } from "@/components/AnalogClock";
import { supabase } from "@/integrations/supabase/client";
import { useTabReorder } from "@/hooks/useTabReorder";
import { SortableTabItem } from "@/components/SortableTabItem";
import { NotificationCenter } from "./NotificationCenter";
import { useRealtime } from "@/hooks/useRealtime";
import { UserStatusIndicator } from "./UserStatusIndicator";
import { ProfilePage } from "./ProfilePage";
import planverseLogoSidebar from "@/assets/planverse-logo-sidebar.png";

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isReorderMode?: boolean;
  onToggleReorder?: () => void;
  onCancelReorder?: () => void;
  sidebarWidth?: number;
}

export const Navigation = ({ 
  currentPage, 
  onPageChange, 
  isReorderMode = false,
  onToggleReorder,
  onCancelReorder,
  sidebarWidth
}: NavigationProps) => {
  const [notifications] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { unreadCount, currentUserStatus } = useRealtime();
  
  const isCollapsed = sidebarWidth !== undefined && sidebarWidth < 180;

  // Fetch courses data
  useEffect(() => {
    if (!user?.id) return;

    const fetchCourses = async () => {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_provider', 'canvas');

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_provider', 'canvas');

      // Process courses similar to Calendar component
      const coursesMap = new Map();

      events?.forEach(event => {
        const courseCode = extractCourseCode(event.title, true);
        if (courseCode) {
          if (!coursesMap.has(courseCode)) {
            coursesMap.set(courseCode, {
              code: courseCode,
              color: getCourseColor(event.title, true),
              events: [],
              tasks: []
            });
          }
          coursesMap.get(courseCode).events.push(event);
        }
      });

      tasks?.forEach(task => {
        const courseCode = task.course_name || extractCourseCode(task.title, true);
        if (courseCode) {
          if (!coursesMap.has(courseCode)) {
            const pseudoTitle = `[2025FA-${courseCode}]`;
            coursesMap.set(courseCode, {
              code: courseCode,
              color: getCourseColor(pseudoTitle, true),
              events: [],
              tasks: []
            });
          }
          coursesMap.get(courseCode).tasks.push(task);
        }
      });

      setCourses(Array.from(coursesMap.values()));
    };

    fetchCourses();
  }, [user?.id]);

  // Helper functions
  const extractCourseCode = (title: string, forCanvas = false) => {
    if (!forCanvas) return null;
    
    const patterns = [
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}\d{3,4}[A-Z]?)\]/,
      /\[([A-Z]{2,4}\d{3,4}[A-Z]?)-(\d{4}[A-Z]{2})\]/,
      /([A-Z]{2,4}\s?\d{3,4}[A-Z]?)/,
      /\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b/
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[2] || match[1];
      }
    }
    return null;
  };

  const getCourseColor = (title: string, forCanvas = false) => {
    if (!forCanvas) return 'bg-muted/50';
    
    const colors = [
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-green-100 border-green-300 text-green-800',
      'bg-purple-100 border-purple-300 text-purple-800',
      'bg-orange-100 border-orange-300 text-orange-800',
      'bg-red-100 border-red-300 text-red-800',
      'bg-pink-100 border-pink-300 text-pink-800',
      'bg-indigo-100 border-indigo-300 text-indigo-800',
      'bg-teal-100 border-teal-300 text-teal-800'
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash + title.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'connect', label: 'Connect', icon: Users },
    { id: 'upload', label: 'Image Upload', icon: Upload },
  ];

  const {
    sensors,
    handleDragEnd,
    getOrderedNavItems,
    DndContext,
    SortableContext,
    verticalListSortingStrategy,
    closestCenter
  } = useTabReorder(navItems);

  const orderedNavItems = getOrderedNavItems();

  return (
    <div 
      className="flex flex-col bg-card border-r border-border relative h-full w-full"
      style={{ 
        height: 'var(--app-height, 100vh)', 
        minHeight: 'var(--app-height, 100vh)',
        maxHeight: 'var(--app-height, 100vh)'
      }}
    >

      {/* Logo */}
      <div className="p-4 pt-1">
        <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          {/* Logo and Text */}
          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1' : 'gap-3'}`}>
            <img 
              src={planverseLogoSidebar} 
              alt="Planverse Logo" 
              className={`object-contain transition-all duration-200 ${isCollapsed ? 'h-6 w-6' : 'h-8 w-8'} rounded`}
            />
            {!isCollapsed && (
              <span className="text-base font-semibold text-foreground">
                Dashboard
              </span>
            )}
          </div>
          
          {/* Reorder Button */}
          <div className="flex flex-col gap-1">
            {!isReorderMode ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleReorder}
                className="h-6 w-6 p-0 hover:bg-muted/30"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelReorder}
                className="h-6 w-6 p-0 hover:bg-muted/30"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {isReorderMode && (
          <div className="mt-2 p-2 bg-gradient-to-r from-primary/5 to-accent/5 rounded border border-primary/20">
            <p className="text-xs text-foreground font-medium text-center">
              Drag tabs to reorder
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-4 space-y-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          autoScroll={false}
        >
          <SortableContext
            items={orderedNavItems.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {orderedNavItems.map((item) => (
                <SortableTabItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  isReorderMode={isReorderMode}
                  notifications={item.id === 'tasks' ? notifications : 0}
                  onClick={() => onPageChange(item.id)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </div>
      </nav>


      {/* User Section */}
      <div className="flex-shrink-0 p-2 border-t border-border">
        {isCollapsed ? (
          <div className="flex justify-center mb-2 px-1">
            <div className="relative">
              <div 
                className="cursor-pointer hover:bg-muted/50 rounded-lg p-1 transition-all duration-200"
                onClick={() => setIsProfileOpen(true)}
                title="View Profile"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-sm">
                    {profile?.display_name?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -right-2 -bottom-1">
                <UserStatusIndicator 
                  status={currentUserStatus} 
                  isCurrentUser={true}
                  size="sm"
                  compact={true}
                />
              </div>
            </div>
          </div>
        ) : (
          <div 
            className="flex items-center gap-2 mb-2 cursor-pointer hover:bg-muted/50 rounded-lg p-1 -m-1 transition-all duration-200"
            onClick={() => setIsProfileOpen(true)}
            title="View Profile"
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white text-sm">
                {profile?.display_name?.charAt(0)?.toUpperCase() || 
                 user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 overflow-hidden transition-all duration-200">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-foreground truncate leading-tight">
                  {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </p>
                <UserStatusIndicator 
                  status={currentUserStatus} 
                  isCurrentUser={true}
                  size="sm"
                />
              </div>
              <p className="text-xs text-muted-foreground truncate leading-tight">
                 {(() => {
                   const currentMajor = profile?.major;
                   if (!currentMajor) return 'Student';
                   
                   // Format predefined majors with proper capitalization
                   return currentMajor.includes('-') ? 
                     currentMajor.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                     currentMajor;
                 })()}
              </p>
            </div>
          </div>
        )}
        
        
        {/* Clock and Controls Section */}
        <div className="mt-1">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-muted/30 transition-all duration-200 ease-out w-8 h-8 p-0"
              >
                <Bell className="h-3.5 w-3.5" />
              </Button>
              <div className="scale-90">
                <AnalogClock />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onPageChange('settings')}
                className="hover:bg-muted/30 transition-all duration-200 ease-out group w-8 h-8 p-0"
              >
                <Settings className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-300 ease-out" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 transition-all duration-200">
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200 ease-out group w-8 h-8 p-0 flex-shrink-0"
              >
                <Bell className="h-3 w-3 transition-all duration-200 ease-out" />
              </Button>
              <div className="flex-1">
                <AnalogClock />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onPageChange('settings')}
                className="hover:bg-muted/30 hover:scale-[1.05] transition-all duration-200 ease-out group w-8 h-8 p-0 flex-shrink-0"
              >
                <Settings className="h-3 w-3 group-hover:rotate-90 transition-transform duration-300 ease-out" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Page Modal */}
      <ProfilePage 
        open={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
      />
    </div>
  );
};