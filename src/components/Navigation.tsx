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

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isReorderMode?: boolean;
  onToggleReorder?: () => void;
  onCancelReorder?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navigation = ({ 
  currentPage, 
  onPageChange, 
  isReorderMode = false,
  onToggleReorder,
  onCancelReorder,
  isCollapsed = false,
  onToggleCollapse
}: NavigationProps) => {
  const [notifications] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { liveEditedProfile } = useProfileEditing();
  const { unreadCount, currentUserStatus } = useRealtime();

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
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'connect', label: 'Connect', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'tasks', label: 'Tasks', icon: Target },
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
    <div className="flex flex-col h-full bg-card border-r border-border relative transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform">
      {/* Collapse button - positioned further right when collapsed */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleCollapse}
        className={`absolute top-1/3 -translate-y-1/2 z-50 h-8 w-8 p-0 hover:bg-muted/50 rounded-md transition-all bg-background border border-border shadow-sm ${
          isCollapsed ? 'right-6' : '-right-2'
        }`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
      {/* Collapse/Expand Button */}

      {/* Logo */}
      <div className="p-4 pt-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">
        <div className="flex items-center justify-between">
          <div className={`text-center flex-1 transition-all duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] overflow-hidden ${
            isCollapsed ? 'opacity-0 -translate-x-6' : 'opacity-100 translate-x-0'
          }`}>
            {!isCollapsed && (
              <>
                <h1 className={`text-lg font-bold text-foreground transition-all duration-300 ease-out ${
                  isCollapsed ? '-translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
                }`}>
                  Planverse
                </h1>
                <p className={`text-xs text-muted-foreground transition-all duration-300 ease-out ${
                  isCollapsed ? '-translate-x-4 opacity-0' : 'translate-x-0 opacity-100'
                }`}>
                  Smart Scheduling
                </p>
              </>
            )}
          </div>
          {/* Small Reorder Button */}
          {!isCollapsed && (
            <div className={`flex flex-col gap-1 transition-all duration-300 ease-out ${
              isCollapsed ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
            }`}>
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
          )}
        </div>
        
        {isReorderMode && !isCollapsed && (
          <div className={`mt-2 p-2 bg-gradient-to-r from-primary/5 to-accent/5 rounded border border-primary/20 transition-all duration-300 ease-out ${
            isCollapsed ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
          }`}>
            <p className="text-xs text-foreground font-medium text-center">
              Drag tabs to reorder
            </p>
          </div>
        )}
      </div>
      
      {/* Instant border separator */}
      {!isCollapsed && <div className="border-b border-border"></div>}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform">
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
            <div className="space-y-3">
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
      </nav>


      {/* User Section */}
      <div className="p-4 border-t border-border transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">
        <div 
          className={`flex items-center gap-3 mb-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 ${
            isCollapsed ? 'justify-center' : ''
          }`}
          onClick={() => setIsProfileOpen(true)}
          title="View Profile"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 
               user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className={`flex-1 min-w-0 transition-all duration-300 ease-out overflow-hidden ${
              isCollapsed ? 'opacity-0 -translate-x-6' : 'opacity-100 translate-x-0'
            }`}>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium text-foreground truncate transition-all duration-300 ease-out ${
                  isCollapsed ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
                }`}>
                  {liveEditedProfile.display_name || profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </p>
                <UserStatusIndicator 
                  status={currentUserStatus} 
                  isCurrentUser={true}
                  size="sm"
                />
              </div>
              <p className={`text-xs text-muted-foreground truncate transition-all duration-300 ease-out ${
                isCollapsed ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
              }`}>
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
          )}
        </div>
        
        
        {/* Clock and Controls Section */}
        {!isCollapsed && (
          <div className={`mt-3 transition-all duration-300 ease-out ${
            isCollapsed ? 'opacity-0 -translate-x-6' : 'opacity-100 translate-x-0'
          }`}>
            <div className="flex items-center justify-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="hover:bg-muted/30 hover:scale-[1.02] transition-all duration-200 ease-out group w-10 h-10 p-0"
              >
                <Bell className="h-4 w-4 transition-all duration-200 ease-out" />
              </Button>
              <AnalogClock />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onPageChange('settings')}
                className="hover:bg-muted/30 hover:scale-[1.05] transition-all duration-200 ease-out group w-10 h-10 p-0"
              >
                <Settings className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300 ease-out" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Page Modal */}
      <ProfilePage 
        open={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
      />
    </div>
  );
};