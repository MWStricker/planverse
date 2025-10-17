import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { Calendar as CalendarIcon, Clock, BookOpen, Target, CheckCircle, AlertCircle, Brain, TrendingUp, Plus, ChevronDown, ChevronRight, Settings, FileText, GraduationCap, Palette, Trash2, AlertTriangle } from "lucide-react";
import { cache, CACHE_TTL } from "@/lib/cache";
import { debounce } from "@/lib/performance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";
import { DailyCalendarView } from "@/components/DailyCalendarView";
import { MonthlyCalendarView } from "@/components/MonthlyCalendarView";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventTaskModal } from "@/components/EventTaskModal";
import { CanvasIntegration } from "@/components/CanvasIntegration";
import { AIEventCreator } from "@/components/AIEventCreator";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DashboardCourses } from "@/components/dashboard/DashboardCourses";
import { getCourseIconById, courseIcons } from "@/data/courseIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday, isTomorrow, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";

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
  const [isAIEventDialogOpen, setIsAIEventDialogOpen] = useState(false);

  // Load data on component mount and listen for updates
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Listen for task and event creation/deletion events
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
        setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
        setCourses(prevCourses => 
          prevCourses.map(course => ({
            ...course,
            tasks: course.tasks.filter(t => t.id !== taskId)
          }))
        );
        console.log('Dashboard: Task removed from local state');
      }
    };

    const handleEventCreated = () => {
      console.log('Dashboard: Event created event received, reloading data');
      loadAllData();
    };

    const handleEventDeleted = (event: any) => {
      console.log('Dashboard: Event deleted event received', event.detail);
      const eventId = event.detail?.eventId;
      if (eventId) {
        // Immediately update local state to remove the event
        setEvents(prevEvents => prevEvents.filter(ev => ev.id !== eventId));
        setCourses(prevCourses => 
          prevCourses.map(course => ({
            ...course,
            events: course.events.filter(ev => ev.id !== eventId)
          }))
        );
        console.log('Dashboard: Event removed from local state');
      }
    };

    const handleDataRefresh = () => {
      console.log('Dashboard: Data refresh event received, reloading data');
      loadAllData();
    };

    window.addEventListener('taskCreated', handleTaskCreated);
    window.addEventListener('taskDeleted', handleTaskDeleted);
    window.addEventListener('eventCreated', handleEventCreated);
    window.addEventListener('eventDeleted', handleEventDeleted);
    window.addEventListener('dataRefresh', handleDataRefresh);

    return () => {
      window.removeEventListener('taskCreated', handleTaskCreated);
      window.removeEventListener('taskDeleted', handleTaskDeleted);
      window.removeEventListener('eventCreated', handleEventCreated);
      window.removeEventListener('eventDeleted', handleEventDeleted);
      window.removeEventListener('dataRefresh', handleDataRefresh);
    };
  }, [user]);

  // Debounced data reload for real-time updates
  const debouncedLoadData = useMemo(
    () => debounce(() => {
      if (user?.id) {
        loadAllData();
      }
    }, 300),
    [user?.id]
  );

  // Real-time listeners with combined channel and debouncing (Phase 5)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public', 
          table: 'events', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          console.log('Dashboard: Real-time event change:', payload);
          debouncedLoadData();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks', 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          console.log('Dashboard: Real-time task change:', payload);
          debouncedLoadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, debouncedLoadData]);

  const loadAllData = useCallback(async () => {
    if (!user?.id) return;
    
    // Phase 1: Check cache first
    const cacheKey = `dashboard_data_${user.id}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Dashboard: Using cached data');
      setEvents(cachedData.events);
      setTasks(cachedData.tasks);
      setCourses(cachedData.courses);
      setStoredColors(cachedData.storedColors);
      setCourseIcons_State(cachedData.courseIcons);
      setLoading(false);
      return;
    }
    
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

      // Phase 2: Optimize queries - only fetch needed columns
      const [eventsResult, tasksResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, title, start_time, end_time, is_completed, event_type, source_provider, description')
          .eq('user_id', user.id),
        supabase
          .from('tasks')
          .select('id, title, due_date, priority_score, completion_status, course_name, source_provider')
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

      // Phase 1: Cache the loaded data
      cache.set(cacheKey, {
        events: allEvents,
        tasks: allTasks,
        courses: processedCourses,
        storedColors: colorMap,
        courseIcons: loadedIcons
      }, CACHE_TTL.COURSE_COLORS);

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
  }, [user?.id, toast]);

  // Phase 3: Memoize icon lookup
  const getCourseIconWithLoadedIcons = useCallback((courseCode: string, loadedIcons: Record<string, string>) => {
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
  }, []);

  // Phase 3: Memoize event toggle handler
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

      // Optimistic update with cache invalidation
      cache.invalidate(`dashboard_data_${user?.id}`);

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
        title: isCompleted ? "Assignment completed" : "Assignment uncompleted",
        description: "Status updated successfully",
      });
      
    } catch (error) {
      console.error('Error toggling event completion:', error);
    }
  }, [user?.id, toast]);

  // Phase 3: Memoize toggle handler
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

  // Phase 3: Quick stats calculations with optimized memoization
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

    return {
      totalCoursesActive: courses.length,
      totalItemsToday: totalToday,
      completedToday,
      progressPercentage: totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0
    };
  }, [events, tasks, courses.length]);

  // Phase 3: Memoize modal handlers
  const openEventModal = useCallback((event: any) => {
    setSelectedEvent(event);
    setSelectedTask(null);
    setIsModalOpen(true);
  }, []);

  const openTaskModal = useCallback((task: any) => {
    setSelectedTask(task);
    setSelectedEvent(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedTask(null);
  }, []);

  // Clear calendar data function with cache invalidation
  const clearAllData = useCallback(async () => {
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

      // Invalidate cache
      cache.invalidate(`dashboard_data_${user.id}`);

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
  }, [user?.id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Today's Items</p>
                <p className="text-2xl font-bold">{dashboardStats.totalItemsToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{dashboardStats.completedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Courses</p>
                <p className="text-2xl font-bold">{dashboardStats.totalCoursesActive}</p>
              </div>
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

        {/* AI Event Creator Button - shows only when Calendar tab is active */}
        {activeTab === 'calendar' && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={() => setIsAIEventDialogOpen(true)}
            >
              <Brain className="h-4 w-4" />
              AI Create Event
            </Button>
          </div>
        )}

        <TabsContent value="overview" className="space-y-6">
          <DashboardOverview
            events={events}
            tasks={tasks}
            courses={courses}
            dashboardStats={dashboardStats}
            onEventToggle={handleEventToggle}
          />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <DashboardCalendar
            events={events}
            tasks={tasks}
            storedColors={storedColors}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            onClearAllData={clearAllData}
          />
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          <DashboardCourses
            courses={courses}
            collapsedCourses={collapsedCourses}
            onToggleCourse={toggleCourse}
            onEventClick={openEventModal}
            onTaskClick={openTaskModal}
            onEventToggle={handleEventToggle}
          />
        </TabsContent>
      </Tabs>

      {/* Event/Task Modal */}
      <EventTaskModal
        isOpen={isModalOpen}
        onClose={closeModal}
        event={selectedEvent || undefined}
        task={selectedTask || undefined}
      />

      {/* AI Event Creator Dialog */}
      <AIEventCreator
        open={isAIEventDialogOpen}
        onOpenChange={setIsAIEventDialogOpen}
        onEventCreated={loadAllData}
        userId={user?.id || ''}
      />
    </div>
  );
});

DashboardIntegratedView.displayName = 'DashboardIntegratedView';