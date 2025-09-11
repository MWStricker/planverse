import { useState, useEffect } from "react";
import { Calendar, Home, Upload, Settings, BookOpen, Target, Bell, Users, ChevronRight } from "lucide-react";
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

interface NavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Navigation = ({ currentPage, onPageChange }: NavigationProps) => {
  const [notifications] = useState(0);
  const [courses, setCourses] = useState<any[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { liveEditedProfile } = useProfileEditing();

  // Fetch course data from Canvas events
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!user) return;
      
      try {
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        if (error) {
          console.error('Error fetching course events:', error);
          return;
        }

        if (events && events.length > 0) {
          // Extract unique courses from Canvas events
          const courseMap = new Map();
          
          events.forEach(event => {
            // Extract course code from title format like [2025FA-PSY-100-007]
            const courseMatch = event.title.match(/\[([A-Z0-9]+-)?([A-Z]+-\d+)/);
            if (courseMatch) {
              const courseCode = courseMatch[2]; // Get PSY-100 part
              if (!courseMap.has(courseCode)) {
                courseMap.set(courseCode, {
                  code: courseCode,
                  events: [],
                  color: getCourseColor(courseCode)
                });
              }
              courseMap.get(courseCode).events.push(event);
            }
          });

          const uniqueCourses = Array.from(courseMap.values());
          setCourses(uniqueCourses);
          setEventsCount(events.length);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    };

    fetchCourseData();
  }, [user]);

  // Generate consistent colors for courses
  const getCourseColor = (courseCode: string) => {
    const colors = [
      'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
      'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
      'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
      'bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-800 dark:text-pink-200',
      'bg-indigo-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
    ];
    
    const hash = courseCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'connect', label: 'Connect', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: Target },
    { id: 'upload', label: 'Image Upload', icon: Upload },
    { id: 'courses', label: 'Courses', icon: BookOpen, badge: courses.length > 0 ? courses.length : null },
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
              {item.id === 'courses' && item.badge && (
                <Badge 
                  className="ml-auto bg-gradient-to-r from-primary/80 to-primary text-primary-foreground text-xs shadow-sm"
                  variant="default"
                >
                  {item.badge}
                </Badge>
              )}
              
              {/* Glow effect for active items */}
              {isActive && (
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 blur-sm -z-10 transition-all duration-300 ease-out"></div>
              )}
            </Button>
          );
        })}

        {/* Course Preview Section */}
        {courses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">My Courses</h3>
              <Badge variant="outline" className="text-xs">
                {eventsCount} items
              </Badge>
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {courses.slice(0, 4).map((course) => (
                  <Card 
                    key={course.code} 
                    className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] ${course.color}`}
                    onClick={() => onPageChange('courses')}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium truncate">{course.code}</p>
                          <p className="text-xs opacity-75">{course.events.length} assignments</p>
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {courses.length > 4 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs"
                    onClick={() => onPageChange('courses')}
                  >
                    +{courses.length - 4} more courses
                  </Button>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
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