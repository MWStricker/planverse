import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Cloud, Sun, CloudRain, Snowflake, Thermometer, AlertTriangle, Clock, BookOpen, CheckCircle, X, Check, Link, Calendar as CalendarIcon, Plus, Trash2, Grid, List } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isSameMonth, addWeeks, subWeeks, startOfDay } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getPriorityColor, getPriorityLabel } from "@/lib/priority-utils";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";
import { DailyCalendarView } from "@/components/DailyCalendarView";
import { MonthlyCalendarView } from "@/components/MonthlyCalendarView";
import { CanvasIntegration } from "./CanvasIntegration";

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
    'LIFE-L': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    'MATH': 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    'MU': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    'PSY': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
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
  
  // Generate a hash from the course code for consistent color assignment
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };
  
  const hash = hashCode(extractedCourseCode);
  const courseColors = [
    'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
    'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
    'bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200',
    'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200',
    'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
    'bg-indigo-100 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200',
    'bg-pink-100 dark:bg-pink-900/20 border-pink-300 dark:border-pink-700 text-pink-800 dark:text-pink-200',
    'bg-teal-100 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200',
    'bg-cyan-100 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200',
    'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200',
    'bg-lime-100 dark:bg-lime-900/20 border-lime-300 dark:border-lime-700 text-lime-800 dark:text-lime-200',
    'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200',
    'bg-rose-100 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200',
    'bg-violet-100 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200',
    'bg-fuchsia-100 dark:bg-fuchsia-900/20 border-fuchsia-300 dark:border-fuchsia-700 text-fuchsia-800 dark:text-fuchsia-200',
    'bg-sky-100 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200',
    'bg-slate-100 dark:bg-slate-900/20 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200',
  ];
  
  // Use hash to select a color from the array
  const colorIndex = hash % courseColors.length;
  return courseColors[colorIndex];
};

const getCourseIcon = (title: string, isCanvas: boolean) => {
  if (!isCanvas) return CalendarIcon;
  
  const courseMatch = title.match(/\[([A-Z]+-\d+)/);
  const courseCode = courseMatch ? courseMatch[1] : title;
  
  const courseIcons = {
    'PSY': BookOpen,
    'MU': BookOpen, 
    'LIFE': BookOpen,
    'MATH': BookOpen,
    'PHYS': BookOpen,
    'CHEM': BookOpen,
    'ENG': BookOpen,
    'HIST': BookOpen,
    'CS': BookOpen,
  };
  
  for (const [prefix, IconComponent] of Object.entries(courseIcons)) {
    if (courseCode.startsWith(prefix)) {
      return IconComponent;
    }
  }
  
  return BookOpen; // Default Canvas icon
};

// Get course color for tasks - try to match with Canvas events 
const getTaskCourseColor = (task: Task, storedColors?: Record<string, string>) => {
  // If task has a course_name, try to match it with Canvas course codes
  if (task.course_name) {
    // Create a pseudo Canvas title to generate the same color as events
    const pseudoTitle = `[2025FA-${task.course_name}]`;
    return getCourseColor(pseudoTitle, true, task.course_name, storedColors);
  }
  
  // Check if task title contains course info
  const courseFromTitle = extractCourseCode(task.title, true);
  if (courseFromTitle) {
    const pseudoTitle = `[2025FA-${courseFromTitle}]`;
    return getCourseColor(pseudoTitle, true, courseFromTitle, storedColors);
  }
  
  // Default color for tasks without course info
  return 'bg-secondary/20 border-secondary text-secondary-foreground';
};

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority_score: number;
  completion_status: string;
  course_name: string;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_pattern?: any;
  source_assignment_id?: string;
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
}

interface StudySession {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  session_type: string;
  location?: string;
  notes?: string;
  is_confirmed?: boolean;
  task_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface WeatherData {
  temp: number;
  maxTemp?: number;
  minTemp?: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location?: string;
}

const Calendar = () => {
  // Function to calculate animation duration based on text length
  const getAnimationDuration = (text: string) => {
    // Very generous time calculation to ensure full readability
    const charactersPerSecond = 3; // Much slower reading speed
    const baseTime = 2; // Longer start time
    const readingTime = text.length / charactersPerSecond;
    const pauseTime = 3; // Much longer pause at end
    const totalTime = baseTime + readingTime + pauseTime;
    
    // Very generous range - minimum 4 seconds, up to 30 seconds
    return Math.min(Math.max(totalTime, 4), 30);
  };
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('day');
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  
  // Cache for preloaded data
  const [dataCache, setDataCache] = useState<Map<string, {
    tasks: Task[];
    events: Event[];
    sessions: StudySession[];
    timestamp: number;
  }>>(new Map());
  const [canvasFeedUrl, setCanvasFeedUrl] = useState('');
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [calendarConnections, setCalendarConnections] = useState<any[]>([]);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  const [weather, setWeather] = useState<{ current?: WeatherData; forecast: { [key: string]: WeatherData } }>(() => {
    // Load cached weather data from localStorage on component mount
    try {
      const cached = localStorage.getItem('weather-data');
      if (cached) {
        const parsedData = JSON.parse(cached);
        // Check if data is less than 30 minutes old
        if (parsedData.timestamp && Date.now() - parsedData.timestamp < 30 * 60 * 1000) {
          return { current: parsedData.current, forecast: parsedData.forecast };
        }
      }
    } catch (error) {
      console.error('Error loading cached weather data:', error);
    }
    return { forecast: {} };
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(() => {
    // Load cached location from localStorage
    try {
      const cached = localStorage.getItem('user-location');
      if (cached) {
        const parsedLocation = JSON.parse(cached);
        // Use cached location if it's less than 1 hour old
        if (parsedLocation.timestamp && Date.now() - parsedLocation.timestamp < 60 * 60 * 1000) {
          return { lat: parsedLocation.lat, lon: parsedLocation.lon };
        }
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);

  // Calculate proper calendar grid (6 weeks)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    // Get user's location with caching and shorter timeout for faster loading
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude
          };
          setUserLocation(location);
          
          // Cache location with timestamp
          try {
            localStorage.setItem('user-location', JSON.stringify({
              ...location,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Error caching location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          // Faster fallback to default location (New York)
          const defaultLocation = { lat: 40.7128, lon: -74.0060 };
          setUserLocation(defaultLocation);
          
          // Cache default location
          try {
            localStorage.setItem('user-location', JSON.stringify({
              ...defaultLocation,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Error caching default location:', error);
          }
        },
        {
          enableHighAccuracy: false, // Faster, less accurate location
          timeout: 5000, // Reduced timeout
          maximumAge: 600000 // Cache location for 10 minutes
        }
      );
    } else if (!userLocation) {
      // If geolocation is not available, use default location
      const defaultLocation = { lat: 40.7128, lon: -74.0060 };
      setUserLocation(defaultLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (user) {
      loadDataForCurrentPeriod();
    }
  }, [user, currentDate, showAllTasks]);

  // Listen for data refresh events from other components (like task creation)
  useEffect(() => {
    const handleDataRefresh = (event: any) => {
      console.log('Calendar received dataRefresh event, user:', !!user, 'event detail:', event.detail);
      if (user) {
        console.log('Clearing cache and fetching fresh data');
        // Clear cache to force fresh data fetch
        setDataCache(new Map());
        
        // Force refresh by bypassing all caching
        const forceRefresh = async () => {
          console.log('Force refresh started');
          setLoading(true);
          try {
            const data = await fetchDataForPeriod(currentDate, viewMode);
            console.log('Fresh data fetched:', { 
              tasksCount: data.tasks.length, 
              eventsCount: data.events.length 
            });
            setTasks(data.tasks);
            setEvents(data.events);
            setStudySessions(data.sessions);
          } catch (error) {
            console.error('Force refresh failed:', error);
          } finally {
            setLoading(false);
          }
        };
        
        forceRefresh();
      }
    };

    // Also handle specific task events for immediate updates
    const handleTaskCreated = (event: any) => {
      console.log('Task created event received:', event.detail);
      if (event.detail?.task) {
        setTasks(prev => [...prev, event.detail.task]);
      }
    };

    // Test event listener to see if ANY events are being received
    const testEventListener = (event: any) => {
      console.log('=== ANY EVENT RECEIVED ===', event.type, event.detail);
    };

    console.log('Setting up Calendar event listeners for user:', !!user);
    
    // Add test listeners for all possible events
    window.addEventListener('taskDeleted', testEventListener);
    window.addEventListener('taskCreated', testEventListener);
    window.addEventListener('dataRefresh', testEventListener);

    const handleTaskDeleted = (event: any) => {
      console.log('=== TASK DELETED EVENT RECEIVED ===');
      console.log('Event detail:', event.detail);
      console.log('Current tasks count:', tasks.length);
      console.log('Task ID to delete:', event.detail?.taskId);
      
      if (event.detail?.taskId) {
        const taskIdToDelete = event.detail.taskId;
        console.log('Filtering out task with ID:', taskIdToDelete);
        
        setTasks(prev => {
          const filteredTasks = prev.filter(task => {
            console.log(`Comparing task ${task.id} with ${taskIdToDelete}:`, task.id !== taskIdToDelete);
            return task.id !== taskIdToDelete;
          });
          console.log('Tasks before filter:', prev.length);
          console.log('Tasks after filter:', filteredTasks.length);
          return filteredTasks;
        });
        
        console.log('Task deletion from state completed');
      } else {
        console.log('No taskId found in event detail');
      }
    };

    console.log('Setting up Calendar event listeners for user:', !!user);
    
    // Set up actual event listeners
    window.addEventListener('dataRefresh', handleDataRefresh);
    window.addEventListener('taskCreated', handleTaskCreated);
    window.addEventListener('taskDeleted', handleTaskDeleted);
    window.addEventListener('tasksCleared', handleDataRefresh);
    window.addEventListener('eventsCleared', handleDataRefresh);

    return () => {
      console.log('Cleaning up Calendar event listeners');
      window.removeEventListener('dataRefresh', handleDataRefresh);
      window.removeEventListener('taskCreated', handleTaskCreated);
      window.removeEventListener('taskDeleted', handleTaskDeleted);
      window.removeEventListener('tasksCleared', handleDataRefresh);
      window.removeEventListener('eventsCleared', handleDataRefresh);
      
      // Remove test listeners
      window.removeEventListener('taskDeleted', testEventListener);
      window.removeEventListener('taskCreated', testEventListener);
      window.removeEventListener('dataRefresh', testEventListener);
    };
  }, [user, currentDate, viewMode]);

  // Set up real-time subscriptions for tasks and events
  useEffect(() => {
    if (!user) return;

    console.log('Setting up real-time subscriptions for user:', user.id);

    const tasksChannel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time task change:', payload);
          // Clear cache and refresh
          setDataCache(new Map());
          const forceRefresh = async () => {
            setLoading(true);
            try {
              const data = await fetchDataForPeriod(currentDate, viewMode);
              setTasks(data.tasks);
              setEvents(data.events);
              setStudySessions(data.sessions);
            } catch (error) {
              console.error('Real-time refresh failed:', error);
            } finally {
              setLoading(false);
            }
          };
          forceRefresh();
        }
      )
      .subscribe();

    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time event change:', payload);
          // Clear cache and refresh
          setDataCache(new Map());
          const forceRefresh = async () => {
            setLoading(true);
            try {
              const data = await fetchDataForPeriod(currentDate, viewMode);
              setTasks(data.tasks);
              setEvents(data.events);
              setStudySessions(data.sessions);
            } catch (error) {
              console.error('Real-time refresh failed:', error);
            } finally {
              setLoading(false);
            }
          };
          forceRefresh();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions');
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, [user, currentDate, viewMode]);

  // Ensure weather loads once geolocation resolves (even after initial render)
  useEffect(() => {
    if (user && userLocation) {
      fetchWeatherData().catch((error) => console.error('Weather refetch failed:', error));
    }
  }, [user, userLocation]);

  // Fetch stored course colors
  useEffect(() => {
    if (!user?.id) return;

    const fetchStoredColors = async () => {
      const { data: colors } = await supabase
        .from('course_colors')
        .select('course_code, canvas_color')
        .eq('user_id', user.id);

      if (colors) {
        const colorMap: Record<string, string> = {};
        colors.forEach(item => {
          colorMap[item.course_code] = item.canvas_color;
        });
        setStoredColors(colorMap);
      }
    };

    fetchStoredColors();
  }, [user?.id]);

  const getCacheKey = (date: Date, mode: 'month' | 'week' | 'day') => {
    if (mode === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 0 });
      return `week-${format(weekStart, 'yyyy-MM-dd')}`;
    } else if (mode === 'day') {
      return `day-${format(date, 'yyyy-MM-dd')}`;
    } else {
      return `month-${format(date, 'yyyy-MM')}`;
    }
  };

  const fetchDataForPeriod = async (date: Date, mode: 'month' | 'week' | 'day') => {
    const cacheKey = getCacheKey(date, mode);
    
    // Check cache first (valid for 5 minutes)
    const cached = dataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached;
    }

    // Calculate date range for the period
    let rangeStart: Date, rangeEnd: Date;
    if (mode === 'week') {
      rangeStart = startOfWeek(date, { weekStartsOn: 0 });
      rangeEnd = endOfWeek(date, { weekStartsOn: 0 });
    } else if (mode === 'day') {
      rangeStart = startOfDay(date);
      rangeEnd = new Date(date);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      rangeStart = startOfWeek(monthStart);
      rangeEnd = endOfWeek(monthEnd);
    }

    try {
      // Fetch data for this specific period
      const tasksQuery = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user?.id);
      
      if (!showAllTasks) {
        tasksQuery
          .gte('due_date', rangeStart.toISOString())
          .lte('due_date', rangeEnd.toISOString());
      }

      const [tasksResult, eventsResult, sessionsResult] = await Promise.allSettled([
        tasksQuery,
        supabase
          .from('events')
          .select('*')
          .eq('user_id', user?.id),
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user?.id)
          .gte('start_time', rangeStart.toISOString())
          .lte('start_time', rangeEnd.toISOString())
      ]);

      const data = {
        tasks: tasksResult.status === 'fulfilled' ? (tasksResult.value.data || []) : [],
        events: eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [],
        sessions: sessionsResult.status === 'fulfilled' ? (sessionsResult.value.data || []) : [],
        timestamp: Date.now()
      };

      // Cache the result
      setDataCache(prev => new Map(prev.set(cacheKey, data)));
      
      return data;
    } catch (error) {
      console.error('Error fetching data for period:', error);
      return { tasks: [], events: [], sessions: [], timestamp: Date.now() };
    }
  };

  const loadDataForCurrentPeriod = async () => {
    const cacheKey = getCacheKey(currentDate, viewMode);
    const cached = dataCache.get(cacheKey);
    
    // If data is cached and fresh, use it instantly without loading state
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      setTasks(cached.tasks);
      setEvents(cached.events);
      setStudySessions(cached.sessions);
      
      // Preload adjacent periods in background
      preloadAdjacentPeriods();
      
      // Fetch weather if needed
      if (userLocation) {
        fetchWeatherData().catch(error => 
          console.error('Weather fetch failed:', error)
        );
      }
      return;
    }
    
    // Only show loading if data is not cached
    setLoading(true);
    try {
      const data = await fetchDataForPeriod(currentDate, viewMode);
      setTasks(data.tasks);
      setEvents(data.events);
      setStudySessions(data.sessions);
      
      // Preload adjacent periods in background
      preloadAdjacentPeriods();

      // Fetch weather data in parallel
      if (userLocation) {
        fetchWeatherData().catch(error => 
          console.error('Weather fetch failed:', error)
        );
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const preloadAdjacentPeriods = async () => {
    if (!user) return;
    
    // Preload previous and next periods in the background
    const prevDate = viewMode === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1);
    const nextDate = viewMode === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
    
    // Don't wait for these - preload in background
    fetchDataForPeriod(prevDate, viewMode).catch(error => 
      console.error('Preload previous period failed:', error)
    );
    fetchDataForPeriod(nextDate, viewMode).catch(error => 
      console.error('Preload next period failed:', error)
    );
  };

  const fetchData = async () => {
    return loadDataForCurrentPeriod();
  };

  const fetchWeatherData = async () => {
    if (!userLocation) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { 
          lat: userLocation.lat, 
          lon: userLocation.lon 
        }
      });

      if (error) {
        console.error('Error fetching weather:', error);
        return;
      }

      // Process the weather data - get current day + 7 days
      const forecastData: { [key: string]: WeatherData } = {};
      
      // Add current day weather
      if (data.current) {
        const today = format(new Date(), 'yyyy-MM-dd');
        forecastData[today] = {
          temp: data.current.temp,
          maxTemp: data.current.temp,
          minTemp: data.current.temp,
          description: data.current.description,
          icon: data.current.icon,
          humidity: data.current.humidity,
          windSpeed: data.current.windSpeed
        };
      }
      
      if (data.forecast) {
        data.forecast.forEach((day: any) => {
          const date = new Date(day.date);
          const dateKey = format(date, 'yyyy-MM-dd');
          forecastData[dateKey] = {
            temp: day.temp,
            maxTemp: day.maxTemp,
            minTemp: day.minTemp,
            description: day.description,
            icon: day.icon,
            humidity: day.humidity,
            windSpeed: day.windSpeed
          };
        });
      }

      setWeather({
        current: data.current,
        forecast: forecastData
      });
    } catch (error) {
      console.error('Error fetching weather data:', error);
    }
  };

  const fetchCalendarConnections = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('fetchCalendarConnections - User ID:', user.id);

      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      console.log('Fetch calendar connections result:', { data, error });

      if (error) {
        console.error('Error fetching calendar connections:', error);
        setCalendarConnections([]);
      } else {
        setCalendarConnections(data || []);
      }
    } catch (error) {
      console.error('Error fetching calendar connections:', error);
      setCalendarConnections([]);
    }
  }, [user]);

  useEffect(() => {
    fetchCalendarConnections();
  }, [fetchCalendarConnections]);

  const addCanvasFeed = async () => {
    if (!canvasFeedUrl.trim() || !user) {
      console.log('Validation failed:', { canvasFeedUrl: canvasFeedUrl.trim(), user });
      return;
    }

    try {
      setIsAddingFeed(true);
      
      console.log('Adding Canvas feed with user:', user);
      console.log('User ID:', user.id);
      console.log('Feed URL:', canvasFeedUrl.trim());
      
      // Check for existing Canvas connections
      const { data: existingConnections, error: fetchError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'canvas');

      if (fetchError) {
        console.error('Error checking existing connections:', fetchError);
        toast({
          title: "Error",
          description: "Failed to check existing connections",
          variant: "destructive",
        });
        return;
      }

      // If there are existing Canvas connections, remove them and their data
      if (existingConnections && existingConnections.length > 0) {
        console.log('Removing existing Canvas connections and data...');
        
        // Delete all Canvas events for the user
        const { error: eventsDeleteError } = await supabase
          .from('events')
          .delete()
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        if (eventsDeleteError) {
          console.error('Error deleting Canvas events:', eventsDeleteError);
        } else {
          console.log('Successfully deleted existing Canvas events');
        }

        // Delete all Canvas tasks for the user (if any)
        const { error: tasksDeleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .eq('source_provider', 'canvas');

        if (tasksDeleteError) {
          console.error('Error deleting Canvas tasks:', tasksDeleteError);
        } else {
          console.log('Successfully deleted existing Canvas tasks');
        }

        // Delete study sessions that might be related to Canvas assignments
        // Only delete if they have Canvas-related content in title or notes
        const { data: existingSessions } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id);

        if (existingSessions && existingSessions.length > 0) {
          const canvasSessionIds = existingSessions
            .filter(session => 
              session.title?.toLowerCase().includes('canvas') ||
              session.notes?.toLowerCase().includes('canvas') ||
              session.title?.match(/\[20\d{2}[A-Z]{2}-[A-Z]+-\d+/) // Match course code pattern
            )
            .map(session => session.id);

          if (canvasSessionIds.length > 0) {
            const { error: sessionsDeleteError } = await supabase
              .from('study_sessions')
              .delete()
              .in('id', canvasSessionIds);

            if (sessionsDeleteError) {
              console.error('Error deleting Canvas study sessions:', sessionsDeleteError);
            } else {
              console.log('Successfully deleted Canvas-related study sessions');
            }
          }
        }

        // Delete the old Canvas connections
        const { error: connectionsDeleteError } = await supabase
          .from('calendar_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'canvas');

        if (connectionsDeleteError) {
          console.error('Error deleting Canvas connections:', connectionsDeleteError);
        } else {
          console.log('Successfully removed existing Canvas connections');
          toast({
            title: "Previous Canvas Feed Replaced",
            description: "Previous Canvas schedule has been removed and will be replaced with the new one",
          });
        }

        // Update local state to only remove Canvas items
        setEvents(prev => prev.filter(event => event.source_provider !== 'canvas'));
        setTasks(prev => prev.filter(task => task.source_provider !== 'canvas'));
        setStudySessions(prev => prev.filter(session => 
          !(session.title?.toLowerCase().includes('canvas') ||
            session.notes?.toLowerCase().includes('canvas') ||
            session.title?.match(/\[20\d{2}[A-Z]{2}-[A-Z]+-\d+/))
        ));
      }

      // Validate URL format (basic check for calendar feed URLs)
      const url = canvasFeedUrl.trim();
      if (!url.startsWith('http') || !url.includes('calendar')) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid Canvas calendar feed URL",
          variant: "destructive",
        });
        return;
      }

      // Add the new Canvas connection
      const { data, error } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: user.id,
          provider: 'canvas',
          provider_id: url,
          is_active: true,
          sync_settings: {
            feed_url: url,
            auto_sync: true,
            sync_type: 'assignments'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding calendar feed:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        toast({
          title: "Error",
          description: `Failed to add calendar feed: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Successfully added calendar feed:', data);
        toast({
          title: "Success",
          description: "Canvas calendar feed added successfully. Syncing events...",
        });
        setCanvasFeedUrl('');
        
        // Refresh calendar connections to show the new feed
        fetchCalendarConnections();
        
        // Trigger Canvas feed sync
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-canvas-feed', {
            body: { connection_id: data.id }
          });
          
          if (syncError) {
            console.error('Sync error:', syncError);
            toast({
              title: "Sync Warning",
              description: "Calendar feed added but sync failed. Events may not appear immediately.",
              variant: "destructive",
            });
          } else {
            console.log('Sync result:', syncData);
            toast({
              title: "Sync Complete",
              description: `${syncData.events_processed || 0} events synced from Canvas`,
            });
            // Refresh calendar data to show new events
            fetchData();
          }
        } catch (syncError) {
          console.error('Sync error:', syncError);
          toast({
            title: "Sync Warning", 
            description: "Calendar feed added but sync failed. Events may not appear immediately.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAddingFeed(false);
    }
  };


  const removeCalendarConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_connections')
        .delete()
        .eq('id', connectionId);

      if (error) {
        console.error('Error removing calendar connection:', error);
        toast({
          title: "Error",
          description: "Failed to remove calendar connection",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Calendar connection removed successfully",
        });
        fetchCalendarConnections();
      }
    } catch (error) {
      console.error('Error removing calendar connection:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const toggleTaskCompletion = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          completion_status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        toast({
          title: "Error",
          description: "Failed to update task status",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Task ${newStatus === 'completed' ? 'completed' : 'marked as pending'}`,
        });
        // Update local state
        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, completion_status: newStatus }
            : task
        ));

        // If task was completed, remove from calendar after 5 seconds
        if (newStatus === 'completed') {
          setCompletingTasks(prev => new Set(prev).add(taskId));
          
          setTimeout(() => {
            setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
            setCompletingTasks(prev => {
              const newSet = new Set(prev);
              newSet.delete(taskId);
              return newSet;
            });
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Error deleting event:', error);
        toast({
          title: "Error",
          description: "Failed to delete event",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Event deleted successfully",
        });
        // Update local state
        setEvents(events.filter(event => event.id !== eventId));
        
        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('dataRefresh'));
        window.dispatchEvent(new CustomEvent('eventsCleared'));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const deleteStudySession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting study session:', error);
        toast({
          title: "Error",
          description: "Failed to delete study session",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Study session deleted successfully",
        });
        // Update local state
        setStudySessions(studySessions.filter(session => session.id !== sessionId));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Task deleted successfully",
        });
        // Update local state
        setTasks(tasks.filter(task => task.id !== taskId));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to manually refresh weather data
  const refreshWeather = async () => {
    try {
      await fetchWeatherData();
    } catch (error) {
      console.error('Error refreshing weather:', error);
    }
  };

  const deleteAllData = async () => {
    if (!user) return;
    
    try {
      // Delete all user data in parallel for better performance
      const deletePromises = [
        // Core data
        supabase.from('tasks').delete().eq('user_id', user.id),
        supabase.from('events').delete().eq('user_id', user.id),
        supabase.from('study_sessions').delete().eq('user_id', user.id),
        // Course and color data
        supabase.from('course_colors').delete().eq('user_id', user.id),
        // OCR uploads
        supabase.from('ocr_uploads').delete().eq('user_id', user.id),
        // Calendar connections
        supabase.from('calendar_connections').delete().eq('user_id', user.id),
        // User settings (optional - keeps profile but clears app settings)
        supabase.from('user_settings').delete().eq('user_id', user.id)
      ];

      const results = await Promise.all(deletePromises);
      
      // Check for any errors
      const hasErrors = results.some(result => result.error);
      if (hasErrors) {
        const errors = results.filter(result => result.error).map(result => result.error);
        throw new Error(`Delete errors: ${errors.map(e => e?.message).join(', ')}`);
      }

      // Immediately clear all local state
      setTasks([]);
      setEvents([]);
      setStudySessions([]);

      toast({
        title: "Success",
        description: "All data has been permanently deleted",
      });

      // Force a complete page refresh to ensure all components are reset
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Error deleting all data:', error);
      toast({
        title: "Error",
        description: "Failed to delete all data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getWeatherIcon = (iconCode: string) => {
    // More precise OpenWeatherMap icon mapping for better accuracy
    const iconMap: { [key: string]: JSX.Element } = {
      '01d': <Sun className="h-4 w-4 text-yellow-500" />, // clear sky day
      '01n': <Sun className="h-4 w-4 text-yellow-400" />, // clear sky night
      '02d': <Cloud className="h-4 w-4 text-gray-400" />, // few clouds day
      '02n': <Cloud className="h-4 w-4 text-gray-500" />, // few clouds night
      '03d': <Cloud className="h-4 w-4 text-gray-500" />, // scattered clouds
      '03n': <Cloud className="h-4 w-4 text-gray-600" />,
      '04d': <Cloud className="h-4 w-4 text-gray-600" />, // broken clouds
      '04n': <Cloud className="h-4 w-4 text-gray-700" />,
      '09d': <CloudRain className="h-4 w-4 text-blue-500" />, // shower rain
      '09n': <CloudRain className="h-4 w-4 text-blue-600" />,
      '10d': <CloudRain className="h-4 w-4 text-blue-500" />, // rain
      '10n': <CloudRain className="h-4 w-4 text-blue-600" />,
      '11d': <CloudRain className="h-4 w-4 text-purple-500" />, // thunderstorm
      '11n': <CloudRain className="h-4 w-4 text-purple-600" />,
      '13d': <Snowflake className="h-4 w-4 text-blue-200" />, // snow
      '13n': <Snowflake className="h-4 w-4 text-blue-300" />,
      '50d': <Cloud className="h-4 w-4 text-gray-300" />, // mist
      '50n': <Cloud className="h-4 w-4 text-gray-400" />
    };
    
    return iconMap[iconCode] || <Sun className="h-4 w-4 text-yellow-500" />;
  };


  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return "Critical";
      case 3: return "High";
      case 2: return "Medium"; 
      case 1: return "Low";
      default: return "Medium";
    }
  };

  const getPriorityIcon = (priority: number) => {
    switch (priority) {
      case 4: return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 3: return <Clock className="h-3 w-3 text-orange-500" />;
      case 2: return <BookOpen className="h-3 w-3 text-yellow-600" />;
      case 1: return <CheckCircle className="h-3 w-3 text-green-500" />;
      default: return <BookOpen className="h-3 w-3 text-blue-500" />;
    }
  };

  const getTasksForDay = (day: Date) => {
    const dayTasks = [];
    
    // Get non-recurring tasks for this day
    const regularTasks = tasks.filter(task => 
      !task.is_recurring && task.due_date && isSameDay(new Date(task.due_date), day)
    );
    dayTasks.push(...regularTasks);
    
    // Get recurring tasks that should appear on this day
    const recurringTasks = tasks.filter(task => task.is_recurring);
    
    for (const task of recurringTasks) {
      if (!task.due_date || !task.recurrence_type) continue;
      
      const taskDate = new Date(task.due_date);
      const shouldShow = checkIfRecurringTaskShouldShow(task, taskDate, day);
      
      if (shouldShow) {
        // Create a copy with the specific day's date
        dayTasks.push({
          ...task,
          due_date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 
                           taskDate.getHours(), taskDate.getMinutes()).toISOString()
        });
      }
    }
    
    // Sort by priority (highest first), then by due date
    return dayTasks.sort((a, b) => {
      if (a.priority_score !== b.priority_score) {
        return (b.priority_score || 0) - (a.priority_score || 0);
      }
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  };

  const checkIfRecurringTaskShouldShow = (task: any, originalDate: Date, targetDay: Date) => {
    if (targetDay < originalDate) return false; // Don't show before start date
    
    switch (task.recurrence_type) {
      case 'daily':
        return true; // Show every day after start date
        
      case 'weekly':
        if (task.recurrence_pattern?.days) {
          return task.recurrence_pattern.days.includes(targetDay.getDay());
        }
        return isSameDay(targetDay, originalDate) || 
               (targetDay > originalDate && targetDay.getDay() === originalDate.getDay());
        
      case 'monthly':
        return targetDay.getDate() === originalDate.getDate();
        
      default:
        return false;
    }
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, day);
    });
  };

  // Helper functions for course management
  const getUniqueCanvasCourses = () => {
    const courses = new Map();
    
    // Extract courses from Canvas events
    events.forEach(event => {
      if (event.source_provider === 'canvas') {
        const courseCode = extractCourseCode(event.title, true);
        if (courseCode) {
          if (!courses.has(courseCode)) {
            courses.set(courseCode, {
              code: courseCode,
              color: getCourseColor(event.title, true, courseCode, storedColors),
              icon: getCourseIcon(event.title, true),
              events: [],
              tasks: []
            });
          }
          courses.get(courseCode).events.push(event);
        }
      }
    });
    
    // Extract courses from Canvas tasks
    tasks.forEach(task => {
      if (task.source_provider === 'canvas' || task.course_name) {
        const courseCode = task.course_name || extractCourseCode(task.title, true);
        if (courseCode) {
          if (!courses.has(courseCode)) {
            const pseudoTitle = `[2025FA-${courseCode}]`;
            courses.set(courseCode, {
              code: courseCode,
              color: getCourseColor(pseudoTitle, true, courseCode, storedColors),
              icon: getCourseIcon(pseudoTitle, true),
              events: [],
              tasks: []
            });
          }
          courses.get(courseCode).tasks.push(task);
        }
      }
    });
    
    return Array.from(courses.values());
  };

  const getCourseItems = (course: any) => {
    const items = [
      ...course.events.map((event: Event) => ({
        ...event,
        type: 'event',
        dueDate: new Date(event.start_time)
      })),
      ...course.tasks.map((task: Task) => ({
        ...task,
        type: 'task',
        dueDate: task.due_date ? new Date(task.due_date) : null
      }))
    ];
    
    // Sort by due date
    return items.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  };

  const toggleCourseExpansion = (courseCode: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseCode)) {
        newSet.delete(courseCode);
      } else {
        newSet.add(courseCode);
      }
      return newSet;
    });
  };

  const getSessionsForDay = (day: Date) => {
    return studySessions.filter(session => 
      isSameDay(new Date(session.start_time), day)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = viewMode === 'week' 
      ? (direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
      : (direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    
    // Always set the new date immediately for instant navigation
    setCurrentDate(newDate);
    
    // The useEffect will handle loading cached data or fetching new data
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <h2 className="text-lg font-semibold text-foreground">Loading Calendar...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy') : viewMode === 'week' ? 'Weekly View' : 'Daily Planner'}
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive" 
                size="default" 
                className="flex items-center gap-2 px-6"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL of your tasks, events, and study sessions. 
                  This action cannot be undone. Are you absolutely sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={deleteAllData}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Clear All button only */}
        </div>
      </div>

      
      {/* View Mode Buttons */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className="rounded-md"
          >
            Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className="rounded-md"
          >
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
            className="rounded-md"
          >
            Month
          </Button>
        </div>
      </div>

      {/* Conditional rendering based on view mode */}
      {viewMode === 'day' ? (
        <DailyCalendarView 
          events={events}
          tasks={tasks}
          storedColors={storedColors}
          currentDay={currentDate}
          setCurrentDay={setCurrentDate}
        />
      ) : viewMode === 'week' ? (
        <WeeklyCalendarView 
          events={events}
          tasks={tasks}
          storedColors={storedColors}
          currentWeek={currentDate}
          setCurrentWeek={setCurrentDate}
        />
      ) : (
        <MonthlyCalendarView 
          events={events}
          tasks={tasks}
          storedColors={storedColors}
          currentMonth={currentDate}
          setCurrentMonth={setCurrentDate}
        />
      )}

      {/* Canvas Integration Section */}
      <div className="mt-8">
        <CanvasIntegration />
      </div>

      {/* Debug button for testing task deletion */}
      {process.env.NODE_ENV === 'development' && tasks.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => {
              const firstTask = tasks[0];
              console.log('Manual test: deleting first task:', firstTask);
              window.dispatchEvent(new CustomEvent('taskDeleted', { 
                detail: { taskId: firstTask.id } 
              }));
            }}
            variant="outline"
            size="sm"
            className="bg-red-500 text-white"
          >
            Test Delete First Task
          </Button>
        </div>
      )}
    </div>
  );
};

export default Calendar;