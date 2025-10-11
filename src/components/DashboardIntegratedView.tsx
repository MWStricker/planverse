import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { Calendar as CalendarIcon, Clock, BookOpen, Target, CheckCircle, AlertCircle, Brain, TrendingUp, Plus, ChevronDown, ChevronRight, Settings, FileText, GraduationCap, Palette, Trash2, AlertTriangle, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";
import { DailyCalendarView } from "@/components/DailyCalendarView";
import { MonthlyCalendarView } from "@/components/MonthlyCalendarView";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventTaskModal } from "@/components/EventTaskModal";
import { CanvasIntegration } from "@/components/CanvasIntegration";
import { CountUpAnimation } from "@/components/animations/CountUpAnimation";
import { CircularProgress } from "@/components/animations/CircularProgress";
import { TrendIndicator } from "@/components/animations/TrendIndicator";
import { SparklineChart } from "@/components/animations/SparklineChart";
import { ConfettiEffect } from "@/components/animations/ConfettiEffect";
import { TimelineView } from "@/components/animations/TimelineView";
import { getCourseIconById, courseIcons } from "@/data/courseIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

interface Course {
  code: string;
  color: string;
  icon: any;
  events: any[];
  tasks: any[];
  totalAssignments: number;
  completedAssignments: number;
  upcomingAssignments: number;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority_score: number;
  completion_status: string;
  course_name: string;
  source_provider?: string;
}

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  source_provider?: string;
  description?: string;
  is_completed?: boolean;
}

// Extract course code consistently from titles or course names
const extractCourseCode = (title: string, isCanvas: boolean = false) => {
  if (!isCanvas) return null;
  
  // Match [BRACKETS] content
  const bracketMatch = title.match(/\[([^\]]+)\]/);
  if (!bracketMatch) return null;
  
  const bracketContent = bracketMatch[1];
  
  // Pattern 1: [2025FA-PSY-100-007] → Extract PSY-100
  const standardMatch = bracketContent.match(/[A-Z0-9]+-([A-Z]+-\d+)/);
  if (standardMatch) return standardMatch[1];
  
  // Pattern 2: [MAC2311C_CMB-25Fall 00279] or [CHS1440C-25Fall 0002] → Extract MAC2311C or CHS1440C
  const courseCodeMatch = bracketContent.match(/^([A-Z]+\d+[A-Z]*)/);
  if (courseCodeMatch) return courseCodeMatch[1];
  
  return null;
};

// Generate colors using stored course colors or fallback
const getCourseColor = (title: string, isCanvas: boolean, courseCode?: string, storedColors?: Record<string, string>) => {
  if (!isCanvas) return 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
  
  const extractedCourseCode = courseCode || extractCourseCode(title, isCanvas);
  if (!extractedCourseCode) return 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200';
  
  // First, try to use stored Canvas color
  if (storedColors && storedColors[extractedCourseCode]) {
    const color = storedColors[extractedCourseCode];
    return `bg-[${color}]/20 border-[${color}]/30 text-[${color}] dark:bg-[${color}]/10 dark:border-[${color}]/40 dark:text-[${color}]`;
  }
  
  // Fallback color mapping based on course type
  const colorMappings: Record<string, string> = {
    'HES': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    'LIFE': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    'PSY': 'bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
    'MU': 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  };
  
  // Direct match first
  if (colorMappings[extractedCourseCode]) {
    return colorMappings[extractedCourseCode];
  }
  
  // Pattern matching for course prefixes
  const prefix = extractedCourseCode.split('-')[0];
  if (colorMappings[prefix]) {
    return colorMappings[prefix];
  }
  
  return 'bg-gray-100 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200';
};

export const DashboardIntegratedView = memo(() => {
  // Performance monitoring in development
  usePerformanceMonitor('DashboardIntegratedView', 16);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for both calendar and courses
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [activeTab, setActiveTab] = useState("overview");
  
  // Calendar data
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  
  // Courses data
  const [courses, setCourses] = useState<Course[]>([]);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [courseIcons_State, setCourseIcons_State] = useState<Record<string, string>>({});
  
  // Modal state for assignment details
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Animation state
  const [showConfetti, setShowConfetti] = useState(false);
  const [previousStats, setPreviousStats] = useState({
    totalItemsToday: 0,
    completedToday: 0,
    totalCoursesActive: 0
  });

  // Load data on component mount and listen for updates
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Listen for task creation events
  useEffect(() => {
    const handleTaskCreated = () => {
      console.log('Dashboard: Task created event received, reloading data');
      loadAllData();
    };

    const handleTaskDeleted = (event: any) => {
      console.log('Dashboard: Task deleted event received', event.detail);
      const taskId = event.detail?.taskId;
      if (taskId) {
        // Immediately update local state to remove the task
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        setCourses(prevCourses => 
          prevCourses.map(course => ({
            ...course,
            tasks: course.tasks.filter(task => task.id !== taskId)
          }))
        );
        console.log('Dashboard: Task removed from local state');
      }
    };

    const handleDataRefresh = () => {
      console.log('Dashboard: Data refresh event received, reloading data');
      loadAllData();
    };

    window.addEventListener('taskCreated', handleTaskCreated);
    window.addEventListener('taskDeleted', handleTaskDeleted);
    window.addEventListener('dataRefresh', handleDataRefresh);

    return () => {
      window.removeEventListener('taskCreated', handleTaskCreated);
      window.removeEventListener('taskDeleted', handleTaskDeleted);
      window.removeEventListener('dataRefresh', handleDataRefresh);
    };
  }, [user]);

  const loadAllData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Load settings first
      const [colorsResult, iconsResult] = await Promise.all([
        supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_colors')
          .maybeSingle(),
        supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_icons')
          .maybeSingle()
      ]);

      // Process course colors
      let colorMap: Record<string, string> = {};
      if (colorsResult.data?.settings_data) {
        colorMap = colorsResult.data.settings_data as Record<string, string>;
        setStoredColors(colorMap);
      }

      // Process course icons
      let loadedIcons: Record<string, string> = {};
      if (iconsResult.data?.settings_data) {
        loadedIcons = iconsResult.data.settings_data as Record<string, string>;
        setCourseIcons_State(loadedIcons);
      }

      // Load events and tasks
      const [eventsResult, tasksResult] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
      ]);

      const allEvents = eventsResult.data || [];
      const allTasks = tasksResult.data || [];

      setEvents(allEvents);
      setTasks(allTasks);

      // Process courses from Canvas data
      const coursesMap = new Map();
      
      // Process Canvas events
      allEvents
        .filter(event => event.source_provider === 'canvas')
        .forEach(event => {
          const courseCode = extractCourseCode(event.title, true);
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
              coursesMap.set(courseCode, {
                code: courseCode,
                color: colorMap[courseCode] || getCourseColor(event.title, true, courseCode),
                icon: getCourseIconWithLoadedIcons(courseCode, loadedIcons),
                events: [],
                tasks: []
              });
            }
            coursesMap.get(courseCode).events.push(event);
          }
        });

      // Process Canvas tasks
      allTasks
        .filter(task => task.source_provider === 'canvas')
        .forEach(task => {
          const courseCode = task.course_name || extractCourseCode(task.title, true);
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
              const pseudoTitle = `[2025FA-${courseCode}]`;
              coursesMap.set(courseCode, {
                code: courseCode,
                color: colorMap[courseCode] || getCourseColor(pseudoTitle, true, courseCode),
                icon: getCourseIconWithLoadedIcons(courseCode, loadedIcons),
                events: [],
                tasks: []
              });
            }
            coursesMap.get(courseCode).tasks.push(task);
          }
        });

      // Calculate statistics for each course
      const processedCourses = Array.from(coursesMap.values()).map(course => {
        const allAssignments = [...course.events, ...course.tasks];
        const completedEvents = course.events.filter(event => event.is_completed).length;
        const completedTasks = course.tasks.filter(task => task.completion_status === 'completed').length;
        const upcomingAssignments = allAssignments.filter(item => {
          const dueDate = item.due_date || item.end_time;
          return dueDate && !isPast(new Date(dueDate));
        }).length;

        return {
          ...course,
          totalAssignments: allAssignments.length,
          completedAssignments: completedEvents + completedTasks,
          upcomingAssignments
        };
      });

      setCourses(processedCourses);
      setCollapsedCourses(new Set(processedCourses.map(course => course.code)));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCourseIconWithLoadedIcons = (courseCode: string, loadedIcons: Record<string, string>) => {
    const customIconId = loadedIcons[courseCode];
    if (customIconId) {
      return getCourseIconById(customIconId);
    }
    
    const code = courseCode.toLowerCase();
    if (code.includes('math') || code.includes('calc') || code.includes('algebra')) return GraduationCap;
    if (code.includes('psy') || code.includes('psychology')) return BookOpen;
    if (code.includes('life') || code.includes('bio') || code.includes('science')) return FileText;
    if (code.includes('hes') || code.includes('health')) return AlertCircle;
    if (code.includes('mu') || code.includes('music')) return BookOpen;
    
    return BookOpen;
  };

  const handleEventToggle = useCallback(async (eventId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_completed: isCompleted })
        .eq('id', eventId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating event completion:', error);
        toast({
          title: "Error",
          description: "Failed to update assignment status",
          variant: "destructive",
        });
        return;
      }

      // Check if this completes the last assignment
      const todayEvents = events.filter(e => isToday(new Date(e.start_time)));
      const incompleteTodayEvents = todayEvents.filter(e => !e.is_completed && e.id !== eventId);
      
      if (isCompleted && incompleteTodayEvents.length === 0) {
        setShowConfetti(true);
      }

      // Update local state
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId ? { ...event, is_completed: isCompleted } : event
        )
      );

      setCourses(prevCourses => 
        prevCourses.map(course => ({
          ...course,
          events: course.events.map(event => 
            event.id === eventId ? { ...event, is_completed: isCompleted } : event
          )
        }))
      );

      toast({
        title: isCompleted ? "Assignment completed! 🎉" : "Assignment uncompleted",
        description: isCompleted ? "Great work!" : "Status updated successfully",
      });
      
    } catch (error) {
      console.error('Error toggling event completion:', error);
    }
  }, [user?.id, toast, events]);

  const toggleCourse = useCallback((courseCode: string) => {
    setCollapsedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseCode)) {
        newSet.delete(courseCode);
      } else {
        newSet.add(courseCode);
      }
      return newSet;
    });
  }, []);

  // Quick stats calculations with historical data
  const dashboardStats = useMemo(() => {
    const today = new Date();
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.start_time);
      return isToday(eventDate);
    });
    
    const todayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return isToday(dueDate);
    });

    const completedToday = todayEvents.filter(e => e.is_completed).length + 
                          todayTasks.filter(t => t.completion_status === 'completed').length;

    const totalToday = todayEvents.length + todayTasks.length;

    // Calculate weekly stats for gamification
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate >= weekStart && eventDate <= weekEnd;
    });
    
    const weekTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate >= weekStart && dueDate <= weekEnd;
    });
    
    const weeklyCompleted = weekEvents.filter(e => e.is_completed).length + 
                           weekTasks.filter(t => t.completion_status === 'completed').length;
    const weeklyTotal = weekEvents.length + weekTasks.length;

    const stats = {
      totalCoursesActive: courses.length,
      totalItemsToday: totalToday,
      completedToday,
      progressPercentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0,
      weeklyCompleted,
      weeklyTotal
    };

    // Update previous stats for trend indicators
    setPreviousStats(prev => ({
      totalItemsToday: prev.totalItemsToday || stats.totalItemsToday,
      completedToday: prev.completedToday || stats.completedToday,
      totalCoursesActive: prev.totalCoursesActive || stats.totalCoursesActive
    }));

    return stats;
  }, [events, tasks, courses]);

  // Modal handlers
  const openEventModal = (event: any) => {
    setSelectedEvent(event);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const openTaskModal = (task: any) => {
    setSelectedTask(task);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedTask(null);
  };

  // Clear calendar data function
  const clearAllData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      console.log('Starting calendar data clear for user:', user.id);

      // Delete all events
      const { error: eventsError } = await supabase
        .from('events')
        .delete()
        .eq('user_id', user.id);

      if (eventsError) {
        console.error('Error deleting events:', eventsError);
      }

      // Delete all tasks
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('user_id', user.id);

      if (tasksError) {
        console.error('Error deleting tasks:', tasksError);
      }

      console.log('Calendar data clear finished successfully');

      // Clear local state immediately
      setEvents([]);
      setTasks([]);
      setCourses([]);

      toast({
        title: "Calendar Data Cleared",
        description: "All events and tasks have been permanently deleted.",
      });

      // Dispatch refresh events
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('dataRefresh'));
        window.dispatchEvent(new CustomEvent('eventsCleared'));
        window.dispatchEvent(new CustomEvent('tasksCleared'));
        window.dispatchEvent(new CustomEvent('canvasDataCleared'));
      }, 500);

    } catch (error) {
      console.error('Error clearing calendar data:', error);
      toast({
        title: "Error",
        description: "Failed to clear calendar data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Skeleton Content Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your integrated calendar and courses overview</p>
        </div>
      </div>

      {/* Quick Stats Cards - Enhanced with Animations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-fade-in hover:shadow-lg hover:scale-105 transition-all duration-200 bg-gradient-to-br from-primary/5 to-primary/10" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Today's Items</p>
                <p className="text-2xl font-bold">
                  <CountUpAnimation end={dashboardStats.totalItemsToday} />
                </p>
                <TrendIndicator 
                  value={dashboardStats.totalItemsToday} 
                  previousValue={previousStats.totalItemsToday}
                  label="from yesterday"
                  className="mt-1"
                />
              </div>
              <CalendarIcon className="h-8 w-8 text-primary" />
            </div>
            <Progress value={dashboardStats.progressPercentage} className="h-1 mt-3" />
          </CardContent>
        </Card>
        
        <Card className="animate-fade-in hover:shadow-lg hover:scale-105 transition-all duration-200 bg-gradient-to-br from-green-500/5 to-green-500/10" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-2xl font-bold">
                  <CountUpAnimation end={dashboardStats.completedToday} />
                </p>
                <TrendIndicator 
                  value={dashboardStats.completedToday} 
                  previousValue={previousStats.completedToday}
                  label="from yesterday"
                  className="mt-1"
                />
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <Progress value={dashboardStats.progressPercentage} className="h-1 mt-3" />
          </CardContent>
        </Card>
        
        <Card className="animate-fade-in hover:shadow-lg hover:scale-105 transition-all duration-200 bg-gradient-to-br from-blue-500/5 to-blue-500/10" style={{ animationDelay: '200ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Courses</p>
                <p className="text-2xl font-bold">
                  <CountUpAnimation end={dashboardStats.totalCoursesActive} />
                </p>
                <TrendIndicator 
                  value={dashboardStats.totalCoursesActive} 
                  previousValue={previousStats.totalCoursesActive}
                  label="from last week"
                  className="mt-1"
                />
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Schedule - Enhanced with Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.filter(event => isToday(new Date(event.start_time))).length > 0 ? (
                  <TimelineView
                    events={events.filter(event => isToday(new Date(event.start_time)))}
                    onEventClick={openEventModal}
                    onToggle={handleEventToggle}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground text-center">No events scheduled for today</p>
                    <p className="text-sm text-muted-foreground mt-2">Time to relax or plan ahead!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Course Progress - Enhanced with Visual Indicators */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Course Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {courses.slice(0, 4).map((course, index) => {
                  const completionRate = course.totalAssignments > 0 
                    ? (course.completedAssignments / course.totalAssignments) * 100 
                    : 0;
                  const statusColor = completionRate > 70 ? 'text-green-600' : completionRate > 40 ? 'text-yellow-600' : 'text-red-600';
                  
                  return (
                    <div 
                      key={course.code} 
                      className="space-y-2 cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-all hover:shadow-md animate-fade-in"
                      onClick={() => setActiveTab("courses")}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CircularProgress 
                            value={course.completedAssignments} 
                            max={course.totalAssignments}
                            size={40}
                          >
                            {React.createElement(course.icon, { className: "h-4 w-4" })}
                          </CircularProgress>
                          <div>
                            <span className="font-medium">{course.code}</span>
                            <p className="text-xs text-muted-foreground">
                              {course.completedAssignments} of {course.totalAssignments} completed
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={statusColor}>
                          {Math.round(completionRate)}%
                        </Badge>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>
                  );
                })}
                {courses.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No courses yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab("calendar")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Canvas
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gamification Section */}
          {courses.length > 0 && (
            <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Your Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Weekly Completion */}
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-md transition-shadow">
                  <div className="flex justify-center mb-3">
                    <CircularProgress 
                      value={dashboardStats.weeklyCompleted} 
                      max={dashboardStats.weeklyTotal}
                      size={80}
                    >
                      <Target className="h-6 w-6 text-primary" />
                    </CircularProgress>
                  </div>
                  <div className="text-2xl font-bold">
                    <CountUpAnimation end={dashboardStats.weeklyCompleted} />
                    <span className="text-muted-foreground">/{dashboardStats.weeklyTotal}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">This Week</div>
                </div>
                
                {/* Completion Rate */}
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-green-500/5 to-green-500/10 hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-2xl font-bold text-green-600">
                    <CountUpAnimation 
                      end={dashboardStats.weeklyTotal > 0 ? Math.round((dashboardStats.weeklyCompleted / dashboardStats.weeklyTotal) * 100) : 0} 
                      suffix="%"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Completion Rate</div>
                </div>
                
                {/* Daily Motivation */}
                <div className="text-center p-4 border rounded-lg bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-2 animate-float">
                    {dashboardStats.completedToday >= dashboardStats.totalItemsToday && dashboardStats.totalItemsToday > 0 ? '🎉' : '💪'}
                  </div>
                  <Badge variant="outline" className="mb-2">
                    {dashboardStats.completedToday >= dashboardStats.totalItemsToday && dashboardStats.totalItemsToday > 0 
                      ? 'All Done!' 
                      : 'Keep Going!'}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {dashboardStats.completedToday >= dashboardStats.totalItemsToday && dashboardStats.totalItemsToday > 0
                      ? 'Amazing work today!'
                      : `${dashboardStats.totalItemsToday - dashboardStats.completedToday} tasks remaining`}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4 animate-fade-in">
          {/* Calendar View Mode Toggle and Clear All Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
            </div>
            
            {/* Clear All Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Clear Calendar Data
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All events (Canvas and manually added)</li>
                      <li>All tasks and assignments</li>
                    </ul>
                    <p className="mt-2 text-sm text-muted-foreground">Your preferences, color settings, and other configurations will be preserved.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={clearAllData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear Calendar Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Calendar Navigation - Date Display Only */}
          <div className="flex items-center justify-center">
            <h2 className="text-xl font-semibold">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
            </h2>
          </div>

          {/* Calendar Component */}
          <div className="border rounded-lg">
            {viewMode === 'day' && (
              <DailyCalendarView
                events={events}
                tasks={tasks}
                storedColors={storedColors}
                currentDay={currentDate}
                setCurrentDay={setCurrentDate}
              />
            )}
            {viewMode === 'week' && (
              <WeeklyCalendarView
                events={events}
                tasks={tasks}
                currentWeek={currentDate}
                setCurrentWeek={setCurrentDate}
              />
            )}
            {viewMode === 'month' && (
              <MonthlyCalendarView
                events={events}
                tasks={tasks}
                currentMonth={currentDate}
                setCurrentMonth={setCurrentDate}
              />
            )}
          </div>

          {/* Canvas Integration */}
          <div className="mt-6">
            <CanvasIntegration />
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4 animate-fade-in">
          <div className="grid gap-4">
            {courses.map(course => {
              const IconComponent = course.icon;
              const isCollapsed = collapsedCourses.has(course.code);
              
              return (
                <Card key={course.code}>
                  <Collapsible
                    open={!isCollapsed}
                    onOpenChange={() => toggleCourse(course.code)}
                  >
                     <CollapsibleTrigger asChild>
                       <CardHeader className="cursor-pointer hover:bg-muted/50 hover:shadow-md transition-all duration-200">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                             <CircularProgress
                               value={course.completedAssignments}
                               max={course.totalAssignments}
                               size={56}
                             >
                               <div 
                                 className="p-2 rounded-lg"
                                 style={{ 
                                   backgroundColor: typeof course.color === 'string' ? `${course.color}20` : undefined,
                                 }}
                               >
                                 <IconComponent className="h-5 w-5" style={{ color: course.color }} />
                               </div>
                             </CircularProgress>
                             <div>
                               <CardTitle className="text-lg">{course.code}</CardTitle>
                               <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                 <span className="flex items-center gap-1">
                                   <CheckCircle className="h-3 w-3" />
                                   {course.completedAssignments}/{course.totalAssignments}
                                 </span>
                                 <Badge variant="outline" className="text-xs">
                                   {course.upcomingAssignments} upcoming
                                 </Badge>
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             <Badge 
                               variant="outline"
                               className={
                                 course.totalAssignments > 0 && (course.completedAssignments / course.totalAssignments) > 0.7 
                                   ? 'text-green-600 border-green-600' 
                                   : 'text-muted-foreground'
                               }
                             >
                               {course.totalAssignments > 0 ? Math.round((course.completedAssignments / course.totalAssignments) * 100) : 0}%
                             </Badge>
                             {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                           </div>
                         </div>
                       </CardHeader>
                     </CollapsibleTrigger>
                     
                     <CollapsibleContent>
                       <CardContent className="pt-0">
                         {/* All Assignments - Scrollable, Sorted by Date with Staggered Animation */}
                         <div className="max-h-96 overflow-y-auto space-y-2">
                           {[...course.events, ...course.tasks]
                             .filter((item: any) => {
                               // Filter out assignments that are more than 3 weeks past due
                               const itemDate = new Date((item as any).end_time || (item as any).start_time || (item as any).due_date || '');
                               const today = new Date();
                               const threeWeeksAgo = new Date(today.getTime() - (21 * 24 * 60 * 60 * 1000));
                               return itemDate >= threeWeeksAgo;
                             })
                             .sort((a, b) => {
                               const dateA = new Date((a as any).end_time || (a as any).start_time || (a as any).due_date || '');
                               const dateB = new Date((b as any).end_time || (b as any).start_time || (b as any).due_date || '');
                               const today = new Date();
                               const diffA = Math.abs(dateA.getTime() - today.getTime());
                               const diffB = Math.abs(dateB.getTime() - today.getTime());
                               return diffA - diffB;
                             })
                             .map((item: any, index: number) => {
                               const isEvent = 'start_time' in item;
                               const isCompleted = isEvent ? (item.is_completed || false) : (item.completion_status === 'completed');
                               
                               return (
                                 <div 
                                   key={item.id} 
                                   className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 hover:shadow-sm transition-all animate-fade-in"
                                   onClick={() => isEvent ? openEventModal(item) : openTaskModal(item)}
                                   style={{ animationDelay: `${index * 20}ms` }}
                                 >
                                   <div className="flex items-center gap-3 flex-1">
                                     <Checkbox 
                                       checked={isCompleted}
                                       onCheckedChange={(checked) => {
                                         if (isEvent) {
                                           handleEventToggle(item.id, checked as boolean);
                                         }
                                       }}
                                       onClick={(e) => e.stopPropagation()}
                                     />
                                     <div className="flex-1 min-w-0">
                                       <span className={isCompleted ? 'line-through text-muted-foreground' : ''}>
                                         {item.title}
                                       </span>
                                       {item.description && (
                                         <p className="text-xs text-muted-foreground truncate mt-1">
                                           {item.description}
                                         </p>
                                       )}
                                     </div>
                                   </div>
                                   <div className="flex items-center gap-2 flex-shrink-0">
                                     <span className="text-sm text-muted-foreground">
                                       {(item.end_time || item.start_time || item.due_date) && 
                                         format(new Date(item.end_time || item.start_time || item.due_date), 'MMM d')
                                       }
                                     </span>
                                     {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
                                   </div>
                                 </div>
                               );
                             })
                           }
                           {([...course.events, ...course.tasks]).length === 0 && (
                             <p className="text-muted-foreground text-center py-8">No assignments found</p>
                           )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
            {courses.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No courses found</h3>
                  <p className="text-muted-foreground text-center">
                    Connect your Canvas account to see your courses here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Event/Task Modal */}
      <EventTaskModal
        isOpen={isModalOpen}
        onClose={closeModal}
        event={selectedEvent || undefined}
        task={selectedTask || undefined}
      />

      {/* Confetti Effect */}
      <ConfettiEffect 
        active={showConfetti} 
        onComplete={() => setShowConfetti(false)} 
      />
    </div>
  );
});

DashboardIntegratedView.displayName = 'DashboardIntegratedView';