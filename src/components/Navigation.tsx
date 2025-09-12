import { useState, useEffect } from "react";
import { Calendar, Home, Upload, Settings, Target, Bell, Users, BookOpen, ChevronRight } from "lucide-react";
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

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  isReorderMode?: boolean;
}

export const Navigation = ({ currentPage, onPageChange, isReorderMode = false }: NavigationProps) => {
  const [notifications] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { liveEditedProfile } = useProfileEditing();

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
      'bg-gradient-to-br from-blue-500/20 to-blue-600/30 border-blue-500/30',
      'bg-gradient-to-br from-green-500/20 to-green-600/30 border-green-500/30',
      'bg-gradient-to-br from-purple-500/20 to-purple-600/30 border-purple-500/30',
      'bg-gradient-to-br from-orange-500/20 to-orange-600/30 border-orange-500/30',
      'bg-gradient-to-br from-red-500/20 to-red-600/30 border-red-500/30',
      'bg-gradient-to-br from-pink-500/20 to-pink-600/30 border-pink-500/30',
      'bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 border-indigo-500/30',
      'bg-gradient-to-br from-teal-500/20 to-teal-600/30 border-teal-500/30'
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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