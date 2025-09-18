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
      'bg-gradient-to-br from-blue-500/10 to-blue-600/15 border-blue-500/20',
      'bg-gradient-to-br from-green-500/10 to-green-600/15 border-green-500/20',
      'bg-gradient-to-br from-purple-500/10 to-purple-600/15 border-purple-500/20',
      'bg-gradient-to-br from-orange-500/10 to-orange-600/15 border-orange-500/20',
      'bg-gradient-to-br from-red-500/10 to-red-600/15 border-red-500/20',
      'bg-gradient-to-br from-pink-500/10 to-pink-600/15 border-pink-500/20',
      'bg-gradient-to-br from-indigo-500/10 to-indigo-600/15 border-indigo-500/20',
      'bg-gradient-to-br from-teal-500/10 to-teal-600/15 border-teal-500/20'
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
    <div className="flex flex-col h-full bg-card border-r border-border relative">
      {/* Collapse/Expand Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleCollapse}
        className={`absolute -right-2.5 top-6 z-10 h-6 w-6 p-0 bg-background hover:bg-primary/10 border border-primary/40 hover:border-primary/70 rounded-full shadow-md hover:shadow-lg transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isCollapsed ? 'rotate-180' : ''
        }`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronLeft className="h-3 w-3 text-primary" />
      </Button>

      {/* Logo */}
      <div className="p-4 pt-1 border-b border-border">
        <div className="flex items-center justify-between">
          <div className={`text-center flex-1 transition-opacity duration-300 ease-out ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {!isCollapsed && (
              <>
                <h1 className="text-lg font-bold text-foreground">Planverse</h1>
                <p className="text-xs text-muted-foreground">Smart Scheduling</p>
              </>
            )}
          </div>
          {/* Small Reorder Button */}
          {!isCollapsed && (
            <div className="flex flex-col gap-1 transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)]">
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
          <div className="mt-2 p-2 bg-gradient-to-r from-primary/5 to-accent/5 rounded border border-primary/20 animate-fade-in">
            <p className="text-xs text-foreground font-medium text-center">
              Drag tabs to reorder
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3">
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
      <div className="p-4 border-t border-border">
        <div className={`flex items-center gap-3 mb-3 transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] ${isCollapsed ? 'justify-center' : ''}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-br from-accent to-primary text-white">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 
               user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {liveEditedProfile.display_name || profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </p>
                <UserStatusIndicator 
                  status={currentUserStatus} 
                  isCurrentUser={true}
                  size="sm"
                />
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
          )}
        </div>
        
        
        {/* Clock and Controls Section */}
        {!isCollapsed && (
          <div className="mt-3 transition-all duration-400 ease-[cubic-bezier(0.23,1,0.32,1)]">
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
    </div>
  );
};