import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar as CalendarIcon, Clock, BookOpen, Target, CheckCircle, AlertCircle, Brain, TrendingUp, Plus, ChevronDown, ChevronRight, Settings, FileText, GraduationCap, Palette, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  
  // For Canvas events, extract from format like [2025FA-PSY-100-007]
  const courseMatch = title.match(/\[([A-Z0-9]+-)?([A-Z]+-\d+)/);
  if (courseMatch) {
    return courseMatch[2]; // Return just the PSY-100 part
  }
  
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

export const DashboardIntegratedView = () => {
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
          .from('course_colors')
          .select('course_code, canvas_color')
          .eq('user_id', user.id),
        supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_icons')
          .maybeSingle()
      ]);

      // Process course colors
      let colorMap: Record<string, string> = {};
      if (colorsResult.data) {
        colorsResult.data.forEach(item => {
          colorMap[item.course_code] = item.canvas_color;
        });
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

  const handleEventToggle = async (eventId: string, isCompleted: boolean) => {
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
  };

  const toggleCourse = (courseCode: string) => {
    setCollapsedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseCode)) {
        newSet.delete(courseCode);
      } else {
        newSet.add(courseCode);
      }
      return newSet;
    });
  };

  // Quick stats calculations
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

  // Clear all data function
  const clearAllData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      console.log('Starting complete data clear for user:', user.id);

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

      // Delete all course colors
      const { error: colorsError } = await supabase
        .from('course_colors')
        .delete()
        .eq('user_id', user.id);

      if (colorsError) {
        console.error('Error deleting course colors:', colorsError);
      }

      // Delete all study sessions
      const { error: sessionsError } = await supabase
        .from('study_sessions')
        .delete()
        .eq('user_id', user.id);

      if (sessionsError) {
        console.error('Error deleting study sessions:', sessionsError);
      }

      // Delete all OCR uploads
      const { error: ocrError } = await supabase
        .from('ocr_uploads')
        .delete()
        .eq('user_id', user.id);

      if (ocrError) {
        console.error('Error deleting OCR uploads:', ocrError);
      }

      // Delete all calendar connections
      const { error: connectionsError } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('user_id', user.id);

      if (connectionsError) {
        console.error('Error deleting calendar connections:', connectionsError);
      }

      // Clear user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id);

      if (settingsError) {
        console.error('Error deleting user settings:', settingsError);
      }

      console.log('Complete data clear finished successfully');

      // Clear local state immediately
      setEvents([]);
      setTasks([]);
      setCourses([]);
      setStoredColors({});
      setCourseIcons_State({});

      toast({
        title: "All Data Cleared",
        description: "All calendar data has been permanently deleted from your account.",
      });

      // Dispatch refresh events
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('dataRefresh'));
        window.dispatchEvent(new CustomEvent('eventsCleared'));
        window.dispatchEvent(new CustomEvent('tasksCleared'));
        window.dispatchEvent(new CustomEvent('canvasDataCleared'));
      }, 500);

    } catch (error) {
      console.error('Error clearing all data:', error);
      toast({
        title: "Error",
        description: "Failed to clear all data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            {dashboardStats.totalCoursesActive} Courses Active
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            {dashboardStats.progressPercentage}% Progress Today
          </Badge>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <div>
                 <p className="text-sm text-muted-foreground">Progress</p>
                 <p className="text-2xl font-bold">{dashboardStats.progressPercentage}%</p>
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

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today's Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {events
                  .filter(event => isToday(new Date(event.start_time)))
                  .slice(0, 5)
                  .map(event => (
                    <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={event.is_completed || false}
                          onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)}
                        />
                        <span 
                          className={`cursor-pointer hover:text-primary ${event.is_completed ? 'line-through text-muted-foreground' : ''}`}
                          onClick={() => openEventModal(event)}
                        >
                          {event.title}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(event.start_time), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                {events.filter(event => isToday(new Date(event.start_time))).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No events scheduled for today</p>
                )}
              </CardContent>
            </Card>

            {/* Course Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Course Progress
                </CardTitle>
              </CardHeader>
               <CardContent className="space-y-3">
                 {courses.slice(0, 4).map(course => (
                   <div 
                     key={course.code} 
                     className="space-y-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                     onClick={() => setActiveTab("courses")}
                   >
                     <div className="flex justify-between items-center">
                       <span className="font-medium">{course.code}</span>
                       <span className="text-sm text-muted-foreground">
                         {course.completedAssignments}/{course.totalAssignments}
                       </span>
                     </div>
                     <div className="w-full bg-muted rounded-full h-2">
                       <div 
                         className="bg-primary h-2 rounded-full" 
                         style={{ 
                           width: `${course.totalAssignments > 0 ? (course.completedAssignments / course.totalAssignments) * 100 : 0}%` 
                         }}
                       />
                     </div>
                   </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
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
                    Clear All Calendar Data
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL calendar data including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All events (Canvas and manually added)</li>
                      <li>All tasks and assignments</li>
                      <li>All course colors and settings</li>
                      <li>All study sessions</li>
                      <li>All OCR uploads</li>
                      <li>All calendar connections</li>
                    </ul>
                    <p className="mt-2 font-medium text-destructive">This action cannot be undone.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={clearAllData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All Data
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

        <TabsContent value="courses" className="space-y-4">
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
                       <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                             <div 
                               className="p-2 rounded-lg"
                               style={{ 
                                 backgroundColor: typeof course.color === 'string' ? `${course.color}20` : undefined,
                                 border: typeof course.color === 'string' ? `1px solid ${course.color}40` : undefined
                               }}
                             >
                               <IconComponent className="h-5 w-5" style={{ color: course.color }} />
                             </div>
                             <div>
                               <CardTitle className="text-lg">{course.code}</CardTitle>
                               <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                 <span>{course.totalAssignments} total assignments</span>
                                 <span>{course.completedAssignments} completed</span>
                                 <span>{course.upcomingAssignments} upcoming</span>
                               </div>
                             </div>
                           </div>
                           <div className="flex items-center gap-2">
                             {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                           </div>
                         </div>
                       </CardHeader>
                     </CollapsibleTrigger>
                     
                     <CollapsibleContent>
                       <CardContent className="pt-0">
                         {/* All Assignments - Scrollable, Sorted by Date */}
                         <div className="max-h-96 overflow-y-auto space-y-2">
                           {[...course.events, ...course.tasks]
                             .filter((item: any) => {
                               // Filter out assignments that are more than 3 weeks past due
                               const itemDate = new Date((item as any).end_time || (item as any).start_time || (item as any).due_date || '');
                               const today = new Date();
                               const threeWeeksAgo = new Date(today.getTime() - (21 * 24 * 60 * 60 * 1000)); // 3 weeks in milliseconds
                               
                               // Keep the assignment if it's not older than 3 weeks past due
                               return itemDate >= threeWeeksAgo;
                             })
                             .sort((a, b) => {
                               // Get dates for comparison - handle both events and tasks
                               const dateA = new Date((a as any).end_time || (a as any).start_time || (a as any).due_date || '');
                               const dateB = new Date((b as any).end_time || (b as any).start_time || (b as any).due_date || '');
                               
                               // Sort by closest to today's date
                               const today = new Date();
                               const diffA = Math.abs(dateA.getTime() - today.getTime());
                               const diffB = Math.abs(dateB.getTime() - today.getTime());
                               
                               return diffA - diffB;
                             })
                             .map((item: any) => {
                               const isEvent = 'start_time' in item;
                               return (
                                 <div 
                                   key={item.id} 
                                   className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                                   onClick={() => isEvent ? openEventModal(item) : openTaskModal(item)}
                                 >
                                   <div className="flex items-center gap-2">
                                     <Checkbox 
                                       checked={isEvent ? (item.is_completed || false) : (item.completion_status === 'completed')}
                                       onCheckedChange={(checked) => {
                                         if (isEvent) {
                                           handleEventToggle(item.id, checked as boolean);
                                         }
                                         // Handle task toggle here if needed for tasks
                                       }}
                                       onClick={(e) => e.stopPropagation()}
                                     />
                                     <span className={
                                       (isEvent ? item.is_completed : item.completion_status === 'completed') 
                                         ? 'line-through text-muted-foreground' 
                                         : ''
                                     }>
                                       {item.title}
                                     </span>
                                   </div>
                                   <span className="text-sm text-muted-foreground">
                                     {(item.end_time || item.start_time || item.due_date) && 
                                       format(new Date(item.end_time || item.start_time || item.due_date), 'MMM d')
                                     }
                                   </span>
                                 </div>
                               );
                             })
                           }
                           {([...course.events, ...course.tasks]).length === 0 && (
                             <p className="text-muted-foreground text-center py-4">No assignments found</p>
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
    </div>
  );
};