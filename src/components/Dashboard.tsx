import { Calendar, Clock, BookOpen, Target, Upload, Plus, CheckCircle, AlertCircle, Brain, CalendarIcon, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo, useCallback } from "react";
import { imageFileToBase64Compressed, cn } from "@/lib/utils";
import { ocrExtractText } from "@/lib/ocr";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useWeeklyProgress } from "@/hooks/useWeeklyProgress";
import { WeeklyProgressCard } from "@/components/WeeklyProgressCard";
import { DebugWeeklyProgress } from "@/components/DebugWeeklyProgress";
import { z } from "zod";
import { filterCanvasAssignments, filterRecentAssignments } from "@/lib/assignment-filters";

interface Task {
  id: string;
  title: string;
  course: string;
  courseColor: string;
  dueDate: string;
  estimatedHours: number;
  priority: 'high' | 'medium' | 'low';
  workloadReason: string;
  completed: boolean;
}

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  location: string;
  type: 'class' | 'exam' | 'study' | 'personal';
  course?: string;
  courseColor?: string;
}

// Task form schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  course_name: z.string().optional(),
  due_date: z.date({
    required_error: "Due date is required",
    invalid_type_error: "Please select a valid date",
  }),
  due_time: z.string().min(1, "Time is required"),
  priority: z.enum(["low", "medium", "high"], {
    required_error: "Priority is required",
  }),
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["daily", "weekly", "monthly"]).optional(),
  recurrence_days: z.array(z.number()).optional(),
});

// Empty mock data for testing
const mockTasks: Task[] = [];

const todaySchedule: ScheduleEvent[] = [];

export const Dashboard = () => {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const { toast } = useToast();
  const [aiSchedule, setAiSchedule] = useState<any>(null);
  const [aiPriorities, setAiPriorities] = useState<any[]>([]);
  const [aiStudyBlocks, setAiStudyBlocks] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isDueThisWeekOpen, setIsDueThisWeekOpen] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<{code: string, color: string}[]>([]);
  
  const handleItemToggle = useCallback(async (item: any, isCompleted: boolean) => {
    console.log('🔄 TOGGLING ITEM:', item.title, 'to', isCompleted);
    try {
      if (item.source_provider === 'canvas' && item.event_type === 'assignment') {
        // Handle Canvas assignments (events)
        console.log('📝 Updating Canvas event:', item.id, 'is_completed:', isCompleted);
        const { error } = await supabase
          .from('events')
          .update({ is_completed: isCompleted })
          .eq('id', item.id)
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

        console.log('✅ Successfully updated Canvas event completion status');
        // Update local events state with logging
        setUserEvents(prevEvents => {
          const updatedEvents = prevEvents.map(event => 
            event.id === item.id ? { ...event, is_completed: isCompleted } : event
          );
          console.log('📊 Updated events - completed count:', updatedEvents.filter(e => e.is_completed).length);
          return updatedEvents;
        });
      } else {
        // Handle manual tasks
        console.log('📝 Updating manual task:', item.id, 'completion_status:', isCompleted ? 'completed' : 'pending');
        const { error } = await supabase
          .from('tasks')
          .update({ 
            completion_status: isCompleted ? 'completed' : 'pending',
            completed_at: isCompleted ? new Date().toISOString() : null
          })
          .eq('id', item.id)
          .eq('user_id', user?.id);

        if (error) {
          console.error('Error updating task completion:', error);
          toast({
            title: "Error",
            description: "Failed to update task status",
            variant: "destructive",
          });
          return;
        }

        console.log('✅ Successfully updated manual task completion status');
        // Update local tasks state with logging
        setUserTasks(prevTasks => {
          const updatedTasks = prevTasks.map(task => 
            task.id === item.id ? { 
              ...task, 
              completion_status: isCompleted ? 'completed' : 'pending',
              completed_at: isCompleted ? new Date().toISOString() : null
            } : task
          );
          console.log('📊 Updated tasks - completed count:', updatedTasks.filter(t => t.completion_status === 'completed').length);
          return updatedTasks;
        });
        setUserTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === item.id ? { 
              ...task, 
              completion_status: isCompleted ? 'completed' : 'pending',
              completed_at: isCompleted ? new Date().toISOString() : null
            } : task
          )
        );
      }

      toast({
        title: isCompleted ? "Item completed" : "Item uncompleted",
        description: "Status updated successfully",
      });
      
      // Notify other components to refresh
      window.dispatchEvent(new CustomEvent('dataRefresh'));
    } catch (error) {
      console.error('Error toggling item completion:', error);
    }
  }, [user, toast]);
  
  const toggleDescription = (taskId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedDescriptions(newExpanded);
  };

  const truncateDescription = (description: string, taskId: string, maxLength: number = 100) => {
    if (!description || description.length <= maxLength) {
      return description;
    }
    
    const isExpanded = expandedDescriptions.has(taskId);
    if (isExpanded) {
      return description;
    }
    
    return description.slice(0, maxLength) + "...";
  };
  
  // Memoized date calculations for performance
  const dateCalculations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { today, endOfToday, startOfWeek, endOfWeek };
  }, []);

  // Memoized task calculations
  const taskMetrics = useMemo(() => {
    const { today, endOfToday, startOfWeek, endOfWeek } = dateCalculations;
    
    // Count tasks that were DUE TODAY and are completed (matching Smart Priority Queue scope)
    const completedTasksCount = userTasks.filter(task => {
      if (task.completion_status !== 'completed' || !task.due_date) return false;
      
      const dueDate = new Date(task.due_date);
      
      // Must be due today (same logic as Smart Priority Queue)
      const wasDueToday = (
        dueDate.getDate() === today.getDate() &&
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getFullYear() === today.getFullYear()
      );
      
      return wasDueToday;
    }).length;
    
    // Count Canvas assignments that were DUE TODAY and are completed
    const completedEventsCount = userEvents.filter(event => {
      if (event.event_type !== 'assignment' || !event.is_completed || !event.event_date) return false;
      
      const eventDate = new Date(event.event_date);
      
      // Must be due today (same logic as Smart Priority Queue)
      const wasDueToday = (
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getFullYear() === today.getFullYear()
      );
      
      return wasDueToday;
    }).length;
    
    const completedTasks = completedTasksCount + completedEventsCount;
    
    return { completedTasks, today, endOfToday, startOfWeek, endOfWeek };
  }, [userTasks, userEvents, dateCalculations]);
  // Use the new weekly progress hook - force re-calculation when events/tasks change
  const weeklyProgressData = useWeeklyProgress(userTasks, userEvents);
  
  // FORCE UPDATE: Add timestamp to force recalculation
  const forceUpdate = Date.now();
  
  // Force re-render when completion status changes by adding a completion hash
  const completionHash = useMemo(() => {
    const completedEvents = userEvents.filter(e => e.is_completed).map(e => e.id).sort().join(',');
    const completedTasks = userTasks.filter(t => t.completion_status === 'completed').map(t => t.id).sort().join(',');
    return `${completedEvents}-${completedTasks}`;
  }, [userTasks, userEvents]);

  
  // Debug completion changes
  useEffect(() => {
    console.log('🔄 COMPLETION STATUS CHANGED:', completionHash);
    console.log('- Total events with is_completed=true:', userEvents.filter(e => e.is_completed).length);
    console.log('- Total tasks with completed status:', userTasks.filter(t => t.completion_status === 'completed').length);
  }, [completionHash, userEvents, userTasks]);

  const completionRate = userTasks.length > 0 ? Math.round((taskMetrics.completedTasks / userTasks.length) * 100) : 0;

  // Task form
  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      course_name: "",
      due_time: "12:00",
      priority: "medium",
      is_recurring: false,
      recurrence_type: undefined,
      recurrence_days: undefined,
    },
  });

  // Memoized filtered data for performance
  const filteredData = useMemo(() => {
    // Calculate actual free time based on scheduled events/tasks today
    const calculateFreeTimeToday = () => {
      // Return default if preferences not loaded yet
      if (!preferences) {
        return "Loading...";
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      // Calculate available hours based on user's sleep schedule
      const [wakeHour, wakeMin] = preferences.wakeUpTime.split(':').map(Number);
      const [bedHour, bedMin] = preferences.bedTime.split(':').map(Number);
      
      // Calculate total awake hours
      let awakeHours = 0;
      if (bedHour > wakeHour) {
        // Same day (e.g., wake at 7, bed at 23)
        awakeHours = (bedHour - wakeHour) + (bedMin - wakeMin) / 60;
      } else {
        // Bed time next day (e.g., wake at 7, bed at 1 AM next day)
        awakeHours = (24 - wakeHour + bedHour) + (bedMin - wakeMin) / 60;
      }
      
      const essentialActivities = 6; // Meals, personal care, commuting, hygiene, etc.
      const availableHours = Math.max(0, awakeHours - essentialActivities);

      // Get events and tasks scheduled for today
      const eventsToday = userEvents.filter(event => {
        if (!event.start_time || !event.end_time) return false;
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(event.end_time);
        return (eventStart >= today && eventStart <= endOfToday) || 
               (eventEnd >= today && eventEnd <= endOfToday);
      });

      const tasksToday = userTasks.filter(task => {
        if (!task.due_date || task.completion_status === 'completed') return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate <= endOfToday;
      });

      // Calculate total scheduled time
      let totalScheduledHours = 0;

      // Add event durations
      eventsToday.forEach(event => {
        if (event.start_time && event.end_time) {
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60); // in hours
          totalScheduledHours += duration;
        } else {
          // Default to 1 hour for events without specific duration
          totalScheduledHours += 1;
        }
      });

      // Add distributed task time and overdue assignments
      const upcomingTasks = userTasks.filter(task => {
        if (!task.due_date || task.completion_status === 'completed') return false;
        const dueDate = new Date(task.due_date);
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        return dueDate <= threeDaysFromNow; // Include overdue and upcoming
      });

      // Include overdue Canvas assignments
      const overdueAssignments = userEvents.filter(event => {
        if (event.event_type !== 'assignment' || event.is_completed) return false;
        if (!event.start_time) return false;
        const dueDate = new Date(event.start_time);
        return dueDate < today; // Overdue assignments
      });

      upcomingTasks.forEach(task => {
        const estimatedHours = task.estimated_hours || 2; // Default to 2 hours for assignments
        const dueDate = new Date(task.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const workDays = Math.max(1, daysUntilDue); // At least 1 day
        
        // Distribute hours across work days
        const dailyHours = estimatedHours / workDays;
        totalScheduledHours += dailyHours;
      });

      // Add overdue assignment workload (prioritize these)
      overdueAssignments.forEach(assignment => {
        totalScheduledHours += 1.5; // Urgent work needed today
      });

      const freeHours = Math.max(0, availableHours - totalScheduledHours);
      return freeHours.toFixed(1) + " hrs";
    };

    const freeTimeToday = calculateFreeTimeToday();
    
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const endOfCurrentWeek = new Date(now);
    endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + daysUntilSunday);
    endOfCurrentWeek.setHours(23, 59, 59, 999);

    // Use EXACTLY the same data as Smart Priority Queue
    // The Smart Priority Queue uses: filteredData.tasksThisWeek + futureCanvasAssignments
    // So the "due this week" count should use the same data sources
    
    const tasksThisWeek = userTasks.filter(task => {
      if (!task.due_date || task.completion_status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      // Include tasks due from the beginning of this week to the end of this week
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - currentDay);
      startOfWeek.setHours(0, 0, 0, 0);
      return dueDate >= startOfWeek && dueDate <= endOfCurrentWeek;
    });
    
    // Don't create a new filter - this will be replaced by futureCanvasAssignments data
    const dueThisWeek = "calculating..."; // Will be updated after futureCanvasAssignments is defined
    
    return { freeTimeToday, eventsThisWeek: [], tasksThisWeek, dueThisWeek };
  }, [userEvents, userTasks, preferences]);
  

  // Get completed tasks and assignments for today
  const completedItemsToday = useMemo(() => {
    const { today, endOfToday } = taskMetrics;
    
    const completedTasksToday = userTasks.filter(task => {
      if (task.completion_status !== 'completed' || !task.completed_at) return false;
      const completedDate = new Date(task.completed_at);
      return completedDate >= today && completedDate <= endOfToday;
    });

    const completedAssignmentsToday = userEvents.filter(event => {
      if (event.event_type !== 'assignment' || !event.is_completed) return false;
      
      // For Canvas assignments, check if they're due today (not when they were completed)
      const eventDate = new Date(event.start_time || event.end_time);
      const isToday = (
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getFullYear() === today.getFullYear()
      );
      
      return isToday;
    });
    
    return { completedTasksToday, completedAssignmentsToday };
  }, [userTasks, userEvents, taskMetrics]);

  const allCompletedToday = useMemo(() => [
    ...completedItemsToday.completedTasksToday.map(task => ({
      id: task.id,
      title: task.title,
      completed_at: task.completed_at,
      type: 'task',
      course_name: task.course_name || 'No Course'
    })),
    ...completedItemsToday.completedAssignmentsToday.map(event => ({
      id: event.id,
      title: event.title,
      completed_at: new Date().toISOString(), // Use current time for completed assignments
      type: 'assignment',
      course_name: event.title.match(/\[([^\]]+)\]/)?.[1] || 'Canvas Course'
    }))
  ].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()), [completedItemsToday]);

  // Get today's tasks ordered by priority (optimized for instant updates)
  const todaysTasks = useMemo(() => {
    const { today } = taskMetrics;
    return userTasks.filter(task => {
      if (!task.due_date || task.completion_status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      return (
        dueDate.getDate() === today.getDate() &&
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getFullYear() === today.getFullYear()
      );
    }).sort((a, b) => {
      // First sort by priority, then by due time
      if ((b.priority_score || 2) !== (a.priority_score || 2)) {
        return (b.priority_score || 2) - (a.priority_score || 2);
      }
      // If same priority, sort by due time
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return 0;
    });
  }, [userTasks, taskMetrics]);

  // Get all assignments due today and beyond from events (Canvas assignments) with dynamic priority
  const futureCanvasAssignments = useMemo(() => {
    // For Smart Priority Queue, we want assignments due this week, not just recent ones
    // So we'll filter differently here than the main filtering function
    const canvasAssignments = userEvents.filter(event => 
      event.event_type === 'assignment' && event.source_provider === 'canvas'
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get start of current week for Smart Priority Queue
    const currentDay = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - currentDay);
    startOfWeek.setHours(0, 0, 0, 0);
    
    console.log('DEBUG - Smart Priority Queue filtering:', {
      today: today.toDateString(),
      startOfWeek: startOfWeek.toDateString()
    });
    
    return canvasAssignments
      .filter(event => {
        const eventDate = new Date(event.start_time || event.end_time || '');
        eventDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
        
        // Include all assignments due from start of this week onwards (including overdue this week)
        const isThisWeekOrLater = eventDate >= startOfWeek;
        
        // Filter out completed assignments
        const isNotCompleted = !event.is_completed;
        
        console.log('DEBUG - Assignment check:', {
          title: event.title,
          eventDate: eventDate.toDateString(),
          isThisWeekOrLater,
          isCompleted: event.is_completed,
          isNotCompleted
        });
        
        return isThisWeekOrLater && isNotCompleted;
      })
      .map(event => {
        const eventDate = new Date(event.start_time || event.end_time);
        
        // Dynamic priority based on due date
        let dynamicPriority = 2; // Default medium priority
        
        // Check if due today
        const isDueToday = (
          eventDate.getDate() === today.getDate() &&
          eventDate.getMonth() === today.getMonth() &&
          eventDate.getFullYear() === today.getFullYear()
        );
        
        // Check if due tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isDueTomorrow = (
          eventDate.getDate() === tomorrow.getDate() &&
          eventDate.getMonth() === tomorrow.getMonth() &&
          eventDate.getFullYear() === tomorrow.getFullYear()
        );
        
        if (isDueToday) {
          dynamicPriority = 4; // Critical priority for today
        } else if (isDueTomorrow) {
          dynamicPriority = 3; // High priority for tomorrow
        } else {
          // Medium priority for future assignments
          dynamicPriority = 2;
        }
        
        // Convert Canvas events to task-like objects for display
        return {
          id: event.id,
          title: event.title,
          due_date: event.start_time || event.end_time,
          priority_score: dynamicPriority,
          completion_status: 'pending',
          source_provider: 'canvas',
          course_name: event.title.match(/\[([^\]]+)\]/)?.[1] || 'Canvas Course',
          description: event.description || 'Canvas Assignment',
          event_type: 'assignment',
          is_completed: event.is_completed || false
        };
      });
  }, [userEvents]); // Add dependency for useMemo

  // Combine all items due this week for the popup - use futureCanvasAssignments to ensure consistency
  const allDueThisWeek = useMemo(() => {
    console.log('🔧 allDueThisWeek calculating...');
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const endOfCurrentWeek = new Date(now);
    endOfCurrentWeek.setDate(endOfCurrentWeek.getDate() + daysUntilSunday);
    endOfCurrentWeek.setHours(23, 59, 59, 999);

    // Get Canvas assignments due this week (already filtered to exclude completed)
    const canvasAssignmentsThisWeek = futureCanvasAssignments.filter(assignment => {
      const dueDate = new Date(assignment.due_date);
      // Include assignments from the beginning of this week to the end of this week
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return dueDate >= startOfWeek && dueDate <= endOfCurrentWeek;
    });

    // Get manual tasks due this week (exclude completed)
    const tasksThisWeek = userTasks.filter(task => {
      if (!task.due_date || task.completion_status === 'completed') return false;
      const dueDate = new Date(task.due_date);
      // Include tasks from the beginning of this week to the end of this week
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return dueDate >= startOfWeek && dueDate <= endOfCurrentWeek;
    });

    const result = [
      ...canvasAssignmentsThisWeek.map(assignment => ({
        id: assignment.id,
        title: assignment.title,
        due_date: assignment.due_date,
        type: 'assignment',
        course_name: assignment.course_name || 'Canvas Course',
        source: 'Canvas'
      })),
      ...tasksThisWeek.map(task => ({
        id: task.id,
        title: task.title,
        due_date: task.due_date,
        type: 'task',
        course_name: task.course_name || 'No Course',
        source: 'Manual'
      }))
    ].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
    console.log('🔧 allDueThisWeek calculated:', result.length, 'items');
    return result;
  }, [futureCanvasAssignments, userTasks]);

  // Get today's Canvas assignments from events (only non-completed ones)
  const todaysCanvasAssignments = futureCanvasAssignments.filter(assignment => {
    const eventDate = new Date(assignment.due_date);
    const today = new Date();
    
    const isToday = (
      eventDate.getDate() === today.getDate() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getFullYear() === today.getFullYear()
    );
    
    // Filter out completed assignments
    const originalEvent = userEvents.find(e => e.id === assignment.id);
    const isNotCompleted = !originalEvent?.is_completed;
    
    return isToday && isNotCompleted;
  });

  // Get today's tasks (only non-completed ones due today or later)
  const todaysActiveTasks = userTasks.filter(task => {
    if (task.completion_status === 'completed' || !task.due_date) return false;
    
    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    // Only show tasks due today
    return (
      dueDate.getDate() === today.getDate() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  });

  // Combine active tasks and Canvas assignments for today
  const allTodaysItems = [...todaysActiveTasks, ...todaysCanvasAssignments].sort((a, b) => {
    // First sort by priority, then by due time
    if ((b.priority_score || 2) !== (a.priority_score || 2)) {
      return (b.priority_score || 2) - (a.priority_score || 2);
    }
    // If same priority, sort by due time
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return 0;
  });

  // Get priority label and color functions
  const getPriorityLabel = (priority: number): string => {
    switch (priority) {
      case 4: return 'Critical';
      case 3: return 'High';
      case 2: return 'Medium';
      case 1: return 'Low';
      default: return 'Medium';
    }
  };

  const getPriorityColor = (priority: number): "default" | "destructive" | "secondary" | "outline" => {
    switch (priority) {
      case 4: return 'destructive';
      case 3: return 'default';
      case 2: return 'secondary';
      case 1: return 'outline';
      default: return 'secondary';
    }
  };

  // Simplified data fetching function - only fetch essential data
  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      // Fetch tasks, events, and available courses concurrently
      const [tasksResult, eventsResult, coursesResult] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('events').select('*').eq('user_id', user.id),
        supabase.from('course_colors').select('course_code, canvas_color').eq('user_id', user.id)
      ]);

      if (tasksResult.data) {
        console.log('Dashboard fetched tasks:', tasksResult.data.length);
        setUserTasks(tasksResult.data);
      }
      if (eventsResult.data) {
        console.log('Dashboard fetched events:', eventsResult.data.length);
        console.log('Events with is_completed=true:', eventsResult.data.filter(e => e.is_completed).length);
        setUserEvents(eventsResult.data);
      }
      
      // Extract unique courses from tasks and course_colors
      const taskCourses = (tasksResult.data || []).map(task => task.course_name).filter(Boolean);
      const storedCourses = (coursesResult.data || []).map(course => ({
        code: course.course_code,
        color: course.canvas_color || '#3b82f6'
      }));
      
      // Combine and deduplicate courses
      const allCourseNames = [...new Set(taskCourses)];
      const coursesWithColors = allCourseNames.map(courseName => {
        const storedCourse = storedCourses.find(c => c.code === courseName);
        return {
          code: courseName,
          color: storedCourse?.color || '#3b82f6'
        };
      });
      
      // Add stored courses that might not have tasks/events yet
      storedCourses.forEach(storedCourse => {
        if (!coursesWithColors.find(c => c.code === storedCourse.code)) {
          coursesWithColors.push(storedCourse);
        }
      });
      
      setAvailableCourses(coursesWithColors);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Listen for data refresh events from other components
  useEffect(() => {
    const handleDataRefresh = () => {
      console.log('Dashboard received dataRefresh event, refreshing data...');
      if (user) {
        fetchDashboardData();
      }
    };

    window.addEventListener('dataRefresh', handleDataRefresh);
    window.addEventListener('tasksCleared', handleDataRefresh);
    window.addEventListener('eventsCleared', handleDataRefresh);
    window.addEventListener('taskCompleted', handleDataRefresh);
    
    // Force an immediate refresh to recalculate with the fixed logic
    handleDataRefresh();

    return () => {
      window.removeEventListener('dataRefresh', handleDataRefresh);
      window.removeEventListener('tasksCleared', handleDataRefresh);
      window.removeEventListener('eventsCleared', handleDataRefresh);
      window.removeEventListener('taskCompleted', handleDataRefresh);
    };
  }, [user]);

  // Fast data fetching and real-time sync
  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Set up optimized real-time subscriptions
      const channel = supabase
        .channel('dashboard-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Task change detected:', payload);
            // Instantly update tasks without full refresh
            if (payload.eventType === 'INSERT') {
              setUserTasks(prev => [...prev, payload.new as any]);
            } else if (payload.eventType === 'UPDATE') {
              setUserTasks(prev => prev.map(task => 
                task.id === payload.new.id ? payload.new as any : task
              ));
            } else if (payload.eventType === 'DELETE') {
              setUserTasks(prev => prev.filter(task => task.id !== payload.old.id));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Event change detected:', payload);
            // Instantly update events without full refresh
            if (payload.eventType === 'INSERT') {
              setUserEvents(prev => [...prev, payload.new as any]);
            } else if (payload.eventType === 'UPDATE') {
              setUserEvents(prev => prev.map(event => 
                event.id === payload.new.id ? payload.new as any : event
              ));
            } else if (payload.eventType === 'DELETE') {
              setUserEvents(prev => prev.filter(event => event.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const getNextRecurrences = (task: any, count: number = 5) => {
    if (!task.is_recurring || !task.recurrence_type) return [];
    
    const baseDate = new Date(task.due_date);
    const dates = [];
    
    for (let i = 0; i < count; i++) {
      if (task.recurrence_type === 'daily') {
        const nextDate = new Date(baseDate);
        nextDate.setDate(baseDate.getDate() + i);
        dates.push(nextDate);
      } else if (task.recurrence_type === 'weekly' && task.recurrence_pattern?.days) {
        for (const dayOfWeek of task.recurrence_pattern.days) {
          const nextDate = new Date(baseDate);
          const daysUntilTarget = (dayOfWeek - nextDate.getDay() + 7) % 7;
          nextDate.setDate(baseDate.getDate() + daysUntilTarget + (Math.floor(i / task.recurrence_pattern.days.length) * 7));
          
          if (nextDate >= baseDate && dates.length < count) {
            dates.push(nextDate);
          }
        }
      } else if (task.recurrence_type === 'monthly') {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + i);
        dates.push(nextDate);
      }
    }
    
    return dates.slice(0, count);
  };

  const onSubmitTask = async (values: z.infer<typeof taskFormSchema>) => {
    if (!user) return;

    const priorityMap = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    // Combine date and time
    const dueDateTime = new Date(values.due_date);
    const [hours, minutes] = values.due_time.split(':');
    dueDateTime.setHours(parseInt(hours), parseInt(minutes));

    const taskData = {
      user_id: user.id,
      title: values.title,
      description: values.description || null,
      course_name: values.course_name === "none" ? null : values.course_name || null,
      due_date: dueDateTime.toISOString(),
      priority_score: priorityMap[values.priority],
      completion_status: 'pending',
      source_provider: 'manual',
      is_recurring: values.is_recurring || false,
      recurrence_type: values.recurrence_type || null,
      recurrence_pattern: values.recurrence_days ? { days: values.recurrence_days } : null,
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error('Error creating task:', error);
        toast({
          title: "Error",
          description: "Failed to create task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: values.is_recurring 
            ? "Recurring task created successfully"
            : "Task created successfully",
        });
        setIsAddDialogOpen(false);
        form.reset();
        fetchDashboardData();
        
        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('dataRefresh'));
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

  const analyzeUserData = async () => {
    if (!user) return;
    
    setIsAnalyzing(true);
    try {
      // Fetch user's events, tasks, and study sessions
      const [eventsResult, tasksResult, studySessionsResult] = await Promise.all([
        supabase.from('events').select('*').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('study_sessions').select('*').eq('user_id', user.id)
      ]);

      const userData = {
        events: eventsResult.data || [],
        tasks: tasksResult.data || [],
        studySessions: studySessionsResult.data || []
      };

      // Store the real data
      setUserEvents(userData.events);
      setUserTasks(userData.tasks);

      // Only run AI analysis if there's data to analyze
      if (userData.events.length > 0 || userData.tasks.length > 0) {
        // Get AI analysis for daily schedule
        const { data: scheduleAnalysis } = await supabase.functions.invoke('ai-schedule-analyzer', {
          body: {
            analysisType: 'daily_schedule',
            data: userData
          }
        });

        if (scheduleAnalysis?.success) {
          const analysis = scheduleAnalysis.analysis;
          setAiSchedule(analysis.todaySchedule || []);
          setAiPriorities(analysis.priorityInsights || []);
          setAiStudyBlocks(analysis.studyBlockSuggestions || []);
        }
      }
    } catch (error) {
      console.error('Error analyzing user data:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    toast({
      title: "Processing image...",
      description: "AI is extracting schedule information",
    });

    try {
      // Preserve PNG uploads without recompression; compress others for speed
      let base64: string;
      let mimeType: string;
      if (file.type === 'image/png') {
        base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => {
            const s = String(fr.result || '');
            resolve(s.split(',')[1] || '');
          };
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        mimeType = 'image/png';
      } else {
        const res = await imageFileToBase64Compressed(file, 1200, 'image/jpeg', 0.75);
        base64 = res.base64;
        mimeType = res.mimeType;
      }

      try {
        // Call our AI OCR edge function
        const { data: response, error } = await supabase.functions.invoke('ai-image-ocr', {
          body: { imageBase64: base64, mimeType, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, currentDate: new Date().toISOString() }
        });

        if (error) {
          console.error('OCR Error:', error);
          throw new Error('Failed to process image');
        }

        if (response.success && response.events && response.events.length > 0) {
          // Add all extracted events to the database
            const eventsToInsert = response.events.map((event: any) => {
              // Avoid timezone shifts by constructing ISO strings directly
              const datePart = String(event.date || '').slice(0, 10); // YYYY-MM-DD
              const startTimePart = String(event.startTime || '00:00').slice(0, 5); // HH:MM
              const endTimePart = String(event.endTime || '00:00').slice(0, 5); // HH:MM
              
              const startTimeISO = `${datePart}T${startTimePart}:00.000Z`;
              const endTimeISO = `${datePart}T${endTimePart}:00.000Z`;

              return {
                user_id: user!.id,
                title: event.title,
                start_time: startTimeISO,
                end_time: endTimeISO,
                location: event.location || '',
                description: `Extracted from image with ${event.confidence}% confidence`,
                event_type: 'class',
                source_provider: 'ocr_upload',
                recurrence_rule: event.recurrence || null
              };
            });

          const { error: insertError } = await supabase
            .from('events')
            .insert(eventsToInsert);

          if (insertError) {
            console.error('Error inserting events:', insertError);
            throw new Error('Failed to save events to calendar');
          }

          toast({
            title: "Schedule uploaded successfully!",
            description: `Added ${response.events.length} events to your calendar`,
          });

          // Refresh the dashboard data
          await analyzeUserData();
        } else {
          // Fallback: client-side OCR to text then AI structuring
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const text = await ocrExtractText(file);
          const { data: textResponse, error: textError } = await supabase.functions.invoke('ai-image-ocr', {
            body: { text, timeZone: tz, currentDate: new Date().toISOString() }
          });

          if (textError) {
            throw new Error('Fallback processing failed');
          }

          if (textResponse.success && textResponse.events && textResponse.events.length > 0) {
            const eventsToInsert = textResponse.events.map((event: any) => {
              // Avoid timezone shifts by constructing ISO strings directly  
              const datePart = String(event.date || '').slice(0, 10); // YYYY-MM-DD
              const startTimePart = String(event.startTime || '00:00').slice(0, 5); // HH:MM
              const endTimePart = String(event.endTime || '00:00').slice(0, 5); // HH:MM
              
              const startTimeISO = `${datePart}T${startTimePart}:00.000Z`;
              const endTimeISO = `${datePart}T${endTimePart}:00.000Z`;

              return {
                user_id: user!.id,
                title: event.title,
                start_time: startTimeISO,
                end_time: endTimeISO,
                location: event.location || '',
                description: `Extracted via OCR fallback with ${event.confidence}% confidence`,
                event_type: 'class',
                source_provider: 'ocr_upload',
                recurrence_rule: event.recurrence || null
              };
            });

            const { error: insertError } = await supabase
              .from('events')
              .insert(eventsToInsert);

            if (insertError) {
              console.error('Error inserting fallback events:', insertError);
              throw new Error('Failed to save events to calendar');
            }

            toast({
              title: "Schedule uploaded successfully!",
              description: `Added ${textResponse.events.length} events to your calendar`,
            });

            // Refresh the dashboard data
            await analyzeUserData();
          } else {
            toast({
              title: "No events found",
              description: "Could not extract any schedule information from the image",
              variant: "destructive",
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error processing image:', error);
        toast({
          title: "Processing failed",
          description: "Failed to extract schedule from image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    }
  };

  const triggerFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  };

  // Empty suggested study blocks for testing
  const suggestedStudyBlocks: any[] = [];

  const handleAcceptStudyBlock = async (studyBlock: any) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to accept study blocks",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the study session with proper date/time formatting
      const today = new Date();
      const [startHour, startMinute] = studyBlock.startTime.split(':');
      const [endHour, endMinute] = studyBlock.endTime.split(':');
      
      const startTime = new Date(today);
      startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      
      const endTime = new Date(today);
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      // Create the study session
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          title: studyBlock.title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location: studyBlock.location,
          notes: studyBlock.description,
          session_type: 'study',
          is_confirmed: true
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating study session:', sessionError);
        toast({
          title: "Error",
          description: "Failed to add study block to calendar",
          variant: "destructive",
        });
        return;
      }

      // Also create a corresponding task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: studyBlock.title,
          description: studyBlock.description,
          due_date: endTime.toISOString(),
          priority_score: 2, // Medium priority for study blocks
          completion_status: 'pending',
          source_provider: 'study_block',
          course_name: studyBlock.location // Use location as course context
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        // Don't fail the whole operation, just log the error
        console.log('Study session created but task creation failed');
      }

      toast({
        title: "Study Block Added!",
        description: `${studyBlock.title} has been added to your calendar and tasks`,
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Good morning! 👋</h1>
            <p className="text-muted-foreground">Here's your day at a glance</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all px-8">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task with due date, time, and priority level.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitTask)} className="space-y-4" autoComplete="off">
                    <input autoComplete="false" name="hidden" type="text" style={{display:'none'}} />
                    <input type="password" autoComplete="new-password" style={{display:'none'}} />
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter task title..." 
                              autoComplete="off" 
                              data-form-type="other"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter task description..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="course_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Course (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a course..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border border-border shadow-lg z-50">
                              <SelectItem value="none">
                                <span className="text-muted-foreground">No course</span>
                              </SelectItem>
                              {availableCourses.map((course) => (
                                <SelectItem key={course.code} value={course.code}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: course.color }}
                                    />
                                    {course.code}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="due_date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Due Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "MMM dd, yyyy")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                    console.log('Date selected:', date);
                                    field.onChange(date);
                                  }}
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return date < today;
                                  }}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="due_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Time</FormLabel>
                            <FormControl>
                              <Input 
                                type="time" 
                                placeholder="12:00" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  Low Priority
                                </div>
                              </SelectItem>
                              <SelectItem value="medium">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-blue-500" />
                                  Medium Priority
                                </div>
                              </SelectItem>
                              <SelectItem value="high">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-orange-500" />
                                  High Priority
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_recurring"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Recurring Task</FormLabel>
                            <FormDescription>
                              Set this task to repeat on a schedule
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("is_recurring") && (
                      <FormField
                        control={form.control}
                        name="recurrence_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recurrence Pattern</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select how often to repeat" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Create Task
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Free Time Today</p>
                  <p className="text-lg font-bold text-foreground">{filteredData.freeTimeToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Tasks Completed</p>
                  <p className="text-lg font-bold text-foreground">
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const endOfToday = new Date(today);
                      endOfToday.setHours(23, 59, 59, 999);
                      
                      console.log('DEBUG: Tasks Completed calculation starting');
                      console.log('DEBUG: Today date range:', today, 'to', endOfToday);
                      
                      // Use the same logic as Smart Priority Queue but filter for today only
                      let todaysItems: any[] = [];
                      
                      if (aiPriorities && aiPriorities.length > 0) {
                        console.log('DEBUG: Using AI priorities');
                        // Filter AI priorities for today
                        todaysItems = aiPriorities.filter((item: any) => {
                          if (!item.dueDate) return false;
                          const itemDate = new Date(item.dueDate);
                          return itemDate >= today && itemDate <= endOfToday;
                        });
                      } else {
                        console.log('DEBUG: Using manual filtering');
                        // Filter manual tasks/assignments for today exactly like Smart Priority Queue
                        const allItems = [...(filteredData?.tasksThisWeek || []), ...(futureCanvasAssignments || [])];
                        console.log('DEBUG: All items to filter:', allItems.length);
                        
                        todaysItems = allItems.filter((item: any) => {
                          if (!item.due_date) return false;
                          const itemDate = new Date(item.due_date);
                          const isToday = itemDate >= today && itemDate <= endOfToday;
                          if (isToday) {
                            console.log('DEBUG: Found today item:', item.title, 'due:', item.due_date);
                          }
                          return isToday;
                        });
                      }
                      
                      console.log('DEBUG: Today\'s items:', todaysItems.length);
                      
                      if (todaysItems.length === 0) {
                        return "No Tasks Today!";
                      }
                      
                      const completedCount = todaysItems.filter((item: any) => {
                        if (aiPriorities && aiPriorities.length > 0) {
                          return item.completed;
                        } else {
                          // Check completion status from updated local state (same as Smart Priority Queue)
                          let isCompleted = false;
                          if (item.source_provider === 'canvas' && item.event_type === 'assignment') {
                            // Find the current state from userEvents (which gets updated by handleItemToggle)
                            const currentEvent = userEvents.find(e => e.id === item.id);
                            isCompleted = currentEvent?.is_completed || false;
                          } else {
                            // Find the current state from userTasks (which gets updated by handleItemToggle)
                            const currentTask = userTasks.find(t => t.id === item.id);
                            isCompleted = currentTask?.completion_status === 'completed';
                          }
                          console.log('DEBUG: Item completion check:', item.title, 'completed:', isCompleted);
                          return isCompleted;
                        }
                      }).length;
                      
                      console.log('DEBUG: Completed count:', completedCount, 'out of', todaysItems.length);
                      
                      return completedCount === todaysItems.length 
                        ? "All Tasks Completed!" 
                        : `${completedCount}/${todaysItems.length}`;
                    })()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-card to-muted border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setIsDueThisWeekOpen(true)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Due This Week</p>
                   <p className="text-lg font-bold text-foreground">{weeklyProgressData.currentWeek.totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Target className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Weekly Progress</p>
                  <p className="text-lg font-bold text-foreground">{weeklyProgressData.currentWeek.progressPercentage}%</p>
                  <p className="text-xs text-muted-foreground">
                    {weeklyProgressData.currentWeek.completedCount} of {weeklyProgressData.currentWeek.totalCount} completed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-80 px-6 pb-6">
                {isAnalyzing ? (
                  <div className="flex items-center justify-center py-8">
                    <Brain className="h-6 w-6 animate-pulse text-primary mr-2" />
                    <span className="text-sm text-muted-foreground">AI analyzing your schedule...</span>
                  </div>
                ) : allTodaysItems.length > 0 ? (
                  <div className="space-y-2">
                    {allTodaysItems.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                         <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                           task.priority_score === 4 ? 'bg-destructive' :  // Critical (due today)
                           task.priority_score === 3 ? 'bg-warning' :      // High (due tomorrow) 
                           task.priority_score === 2 ? 'bg-primary' :      // Medium (due this week)
                           task.priority_score === 1 ? 'bg-muted-foreground' : // Low
                           'bg-secondary'  // Default
                         }`} />
                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <p className="font-medium text-sm text-foreground leading-tight">{task.title}</p>
                             {task.source_provider === 'canvas' && (
                               <Badge variant="secondary" className="text-xs h-4 px-2 bg-transparent border-0">
                                 Canvas
                               </Badge>
                             )}
                           </div>
                           <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                             <Clock className="h-3 w-3" />
                             <span>{task.due_date ? (() => {
                               const date = new Date(task.due_date);
                               if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
                                 const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                                 return format(fixedDate, "hh:mm a");
                               }
                               return format(date, "hh:mm a");
                             })() : "No time"}</span>
                           </div>
                           {task.course_name && (
                             <p className="text-xs text-muted-foreground truncate">{task.course_name}</p>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (aiSchedule && aiSchedule.length > 0) ? (
                  <div className="space-y-2">
                    {aiSchedule.map((event: any) => (
                      <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          event.type === 'class' ? `bg-${event.courseColor}` :
                          event.type === 'study' ? 'bg-accent' :
                          'bg-muted-foreground'
                        }`} />
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-sm mb-1 leading-tight">{event.title}</p>
                           <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                             <Clock className="h-3 w-3" />
                             <span>{event.time}</span>
                           </div>
                           {event.location && (
                             <p className="text-xs text-muted-foreground truncate">{event.location}</p>
                           )}
                         </div>
                        {event.type === 'study' && (
                          <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">
                            Suggested
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-center">
                    <div>
                      <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">There are no tasks to complete!</p>
                      <p className="text-xs text-muted-foreground">Enjoy your free time</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Priority Queue */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Smart Priority Queue
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                  Workload-Based
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-4">
                  <Brain className="h-6 w-6 animate-pulse text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">AI prioritizing your tasks...</span>
                </div>
              ) : (aiPriorities && aiPriorities.length > 0) ? (
                aiPriorities.map((task: any, index: number) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
                      task.completed ? 'bg-success/5 border-success/20' : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full bg-${task.courseColor || 'primary'}`} />
                      </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <h3 className={`font-medium text-sm leading-tight ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                             {task.title}
                           </h3>
                           {task.course && (
                             <Badge variant="secondary" className="text-xs bg-transparent border-0 h-4 px-2">
                               {task.course}
                             </Badge>
                           )}
                         </div>
                         <p className="text-xs text-muted-foreground mb-1 leading-relaxed">{task.workloadReason || task.description}</p>
                         <div className="flex items-center gap-4 text-xs text-muted-foreground">
                           <span>Due: {task.dueDate || 'No due date'}</span>
                           <span>Est: {task.estimatedHours || 0}h</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {task.priority || 'medium'}
                      </Badge>
                      {task.completed && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </div>
                ))
              ) : (() => {
                // Debug: log what data we have
                console.log('Debug - filteredData:', filteredData);
                console.log('Debug - futureCanvasAssignments:', futureCanvasAssignments);
                
                // Filter out tasks more than a week overdue before checking length
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const filteredTasks = filteredData?.tasksThisWeek || []; // Already filtered
                const filteredCanvasAssignments = futureCanvasAssignments || []; // Already filtered
                
                console.log('🎯 DEBUG - Smart Priority Queue:');
                console.log('- userTasks total:', userTasks?.length || 0);
                console.log('- userEvents total:', userEvents?.length || 0);
                console.log('- filteredData:', filteredData);
                console.log('- filteredTasks (tasksThisWeek):', filteredTasks.length, filteredTasks.map(t => ({title: t.title, due: t.due_date})));
                console.log('- futureCanvasAssignments:', filteredCanvasAssignments.length, filteredCanvasAssignments.map(c => ({title: c.title, due: c.due_date})));
                console.log('- Total items in Smart Queue:', [...filteredTasks, ...filteredCanvasAssignments].length);
                
                // Show specific tasks that should be in this week
                const now = new Date();
                const currentDay = now.getDay();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(startOfWeek.getDate() - currentDay);
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);
                
                console.log('📅 This week range:', startOfWeek.toDateString(), 'to', endOfWeek.toDateString());
                
                const tasksInRange = userTasks.filter(task => {
                  if (!task.due_date || task.completion_status === 'completed') return false;
                  const dueDate = new Date(task.due_date);
                  return dueDate >= startOfWeek && dueDate <= endOfWeek;
                });
                
                const eventsInRange = userEvents.filter(event => {
                  if (event.event_type !== 'assignment' || event.source_provider !== 'canvas' || event.is_completed) return false;
                  const eventDate = new Date(event.start_time || event.end_time || '');
                  return eventDate >= startOfWeek && eventDate <= endOfWeek;
                });
                
                console.log('📋 Raw tasks this week:', tasksInRange.map(t => ({title: t.title, due: t.due_date})));
                console.log('📋 Raw Canvas assignments this week:', eventsInRange.map(e => ({title: e.title, due: e.start_time})));
                
                return [...filteredTasks, ...filteredCanvasAssignments].length > 0;
              })() ? (
                (() => {
                  // Filter out old assignments first, then sort
                  const currentDate = new Date();
                  const oneWeekAgo = new Date(currentDate);
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  
                  // Filter out assignments more than a week overdue
                  const currentRelevantItems = [...(filteredData?.tasksThisWeek || []), ...(futureCanvasAssignments || [])].filter(item => {
                    if (!item.due_date) return true; // Keep items without due dates
                    const dueDate = new Date(item.due_date);
                    return dueDate >= oneWeekAgo; // Only keep assignments from the last week or future
                  });
                  
                  console.log('🧹 Filtered out old assignments. Current relevant items:', currentRelevantItems.length);
                  console.log('🧹 Items kept:', currentRelevantItems.map(item => `${item.title} (due: ${item.due_date})`));
                  
                  // Sort by priority first, then by due date (recent due dates first)
                  const sortedItems = currentRelevantItems.sort((a, b) => {
                    // First sort by priority score (higher priority first)
                    const priorityDiff = (b.priority_score || 2) - (a.priority_score || 2);
                    if (priorityDiff !== 0) return priorityDiff;
                    
                    // Then sort by due date (sooner due dates first)
                    if (a.due_date && b.due_date) {
                      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                    }
                    return 0;
                  });

                  // Group items by date
                  const groupedItems = sortedItems.reduce((groups: any, item: any) => {
                    const date = item.due_date ? new Date(item.due_date) : new Date();
                    // Check if date is valid before formatting
                    if (isNaN(date.getTime())) {
                      console.warn('Invalid date found for item:', item.title, 'due_date:', item.due_date);
                      return groups; // Skip items with invalid dates
                    }
                    const dateKey = format(date, 'yyyy-MM-dd');
                    
                    if (!groups[dateKey]) {
                      groups[dateKey] = {
                        date: date,
                        items: []
                      };
                    }
                    groups[dateKey].items.push(item);
                    return groups;
                  }, {});

                  const today = new Date();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  const getDateLabel = (date: Date) => {
                    // Validate date before formatting
                    if (isNaN(date.getTime())) {
                      return 'Invalid Date';
                    }
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const todayStr = format(today, 'yyyy-MM-dd');
                    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
                    
                    if (dateStr === todayStr) return 'Today';
                    if (dateStr === tomorrowStr) return 'Tomorrow';
                    return format(date, 'EEEE, MMM d');
                   };

                   // Don't filter out completed items, but sort them within each day
                   const sortedGroups = Object.fromEntries(
                     Object.entries(groupedItems).map(([dateKey, group]: [string, any]) => [
                       dateKey,
                       {
                         ...group,
                         items: group.items.sort((a: any, b: any) => {
                           // First check completion status
                           const aCompleted = a.source_provider === 'canvas' && a.event_type === 'assignment' 
                             ? userEvents.find(e => e.id === a.id)?.is_completed 
                             : a.completion_status === 'completed';
                           const bCompleted = b.source_provider === 'canvas' && b.event_type === 'assignment' 
                             ? userEvents.find(e => e.id === b.id)?.is_completed 
                             : b.completion_status === 'completed';
                           
                           // Sort incomplete items first, then completed items
                           if (aCompleted !== bCompleted) {
                             return aCompleted ? 1 : -1;
                           }
                           
                           // Within same completion status, sort by priority
                           return (b.priority_score || 2) - (a.priority_score || 2);
                         })
                       }
                     ])
                   );

                   return (
                     <div className="space-y-6">
                       {Object.values(sortedGroups).map((group: any, groupIndex: number) => (
                        <div key={groupIndex} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">
                              {getDateLabel(group.date)}
                            </h4>
                            <div className="h-px bg-border flex-1" />
                            <span className="text-xs text-muted-foreground">
                              {group.date && !isNaN(group.date.getTime()) ? format(group.date, 'MMM d, yyyy') : 'Invalid Date'}
                            </span>
                          </div>
                           {group.items.map((task: any, index: number) => {
                             const isCompleted = task.source_provider === 'canvas' && task.event_type === 'assignment' 
                               ? userEvents.find(e => e.id === task.id)?.is_completed 
                               : task.completion_status === 'completed';
                             
                             return (
                             <div 
                               key={task.id} 
                               className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md bg-card border-border ${
                                 isCompleted ? 'opacity-60' : ''
                               }`}
                             >
                               <Checkbox
                                 checked={isCompleted}
                                 onCheckedChange={(checked) => {
                                   handleItemToggle(task, !!checked);
                                 }}
                                 className="flex-shrink-0"
                               />
                               <div 
                                 className="flex items-center gap-3 flex-1 cursor-pointer"
                                 onClick={() => {
                                   setSelectedTask(task);
                                   setIsTaskDetailOpen(true);
                                 }}
                               >
                                 <div className="flex items-center gap-2">
                                   <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                   <div className={`w-2 h-2 rounded-full ${
                                      task.priority_score === 3 ? 'bg-destructive' :
                                      task.priority_score === 2 ? 'bg-primary' :
                                      task.priority_score === 1 ? 'bg-muted-foreground' :
                                      'bg-secondary'
                                   }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2 mb-1">
                                     <h3 className={`font-medium text-foreground ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                       {task.title}
                                     </h3>
                                    {task.source_provider === 'canvas' && (
                                      <Badge variant="secondary" className="text-xs bg-transparent border-0">
                                        Canvas
                                      </Badge>
                                    )}
                                    {task.event_type === 'assignment' && (
                                      <Badge variant="secondary" className="text-xs bg-transparent border-0">
                                        Assignment
                                      </Badge>
                                    )}
                                    {task.course_name && (
                                      <Badge variant="secondary" className="text-xs bg-transparent border-0">
                                        {task.course_name}
                                      </Badge>
                                    )}
                                   </div>
                                   <div className={`text-sm mb-1 ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                     {task.description ? (
                                      <div>
                                        {task.description.length > 60 ? (
                                          <>
                                            <span>{task.description.slice(0, 60)}</span>
                                            {!expandedDescriptions.has(task.id) && <span>...</span>}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleDescription(task.id);
                                              }}
                                              className="ml-1 text-primary hover:underline text-xs font-medium"
                                            >
                                              {expandedDescriptions.has(task.id) ? "less" : "more"}
                                            </button>
                                            {expandedDescriptions.has(task.id) && (
                                              <div className="mt-1">
                                                <span>{task.description.substring(60).trim()}</span>
                                                {task.source_provider === 'canvas' && task.description.length === 63 && (
                                                  <div className="mt-1 text-xs text-orange-600">
                                                    ⚠️ Canvas description appears truncated - check Canvas directly for complete instructions
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <div>
                                            <span>{task.description}</span>
                                            {task.source_provider === 'canvas' && task.description.length === 63 && (
                                              <div className="mt-1 text-xs text-orange-600">
                                                ⚠️ Canvas description appears truncated - check Canvas directly for complete instructions
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>No description available</span>
                                    )}
                                   </div>
                                   <div className={`flex items-center gap-4 text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                                     <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span className="font-medium">
                                         {task.due_date ? (() => {
                                           const date = new Date(task.due_date);
                                           if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
                                             const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                                             return format(fixedDate, "hh:mm a");
                                           }
                                           return format(date, "hh:mm a");
                                         })() : "No time set"}
                                      </span>
                                    </div>
                                    {task.estimated_hours && (
                                      <span>Est: {task.estimated_hours}h</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={getPriorityColor(task.priority_score || 2)}
                                  className="text-xs"
                                >
                                  {getPriorityLabel(task.priority_score || 2)}
                                </Badge>
                              </div>
                            </div>
                            );
                           })}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center py-8 text-center">
                  <div>
                    <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No tasks due today</p>
                    <p className="text-xs text-muted-foreground">Tasks and assignments will appear here when due today</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suggested Study Blocks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Suggested Study Blocks
              <Badge variant="secondary" className="ml-2 bg-accent/10 text-accent">
                AI Optimized
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <Brain className="h-8 w-8 animate-pulse text-primary mr-3" />
                <span className="text-muted-foreground">AI optimizing your study blocks...</span>
              </div>
            ) : (aiStudyBlocks && aiStudyBlocks.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiStudyBlocks.map((block: any, index: number) => (
                  <div key={block.id} className={`p-4 rounded-lg ${
                    index === 0 
                      ? 'bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20'
                      : index === 1
                        ? 'bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20'
                        : 'bg-gradient-to-br from-muted/50 to-muted border border-border'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">{block.title}</h4>
                      <Badge className={
                        block.priority === 'Optimal' 
                          ? 'bg-primary text-primary-foreground'
                          : block.priority === 'Good'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-outline text-foreground'
                      }>
                        {block.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{block.time} • {block.location}</p>
                    <p className="text-sm text-foreground mb-3">{block.description}</p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className={index === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}
                        onClick={() => handleAcceptStudyBlock(block)}
                      >
                        Accept
                      </Button>
                      <Button size="sm" variant="outline">Modify</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-center">
                <div>
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No study blocks suggested yet</p>
                  <p className="text-xs text-muted-foreground">AI will optimize study times after analyzing your schedule</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Detail Modal */}
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                selectedTask?.priority_score === 3 ? 'bg-destructive' :
                selectedTask?.priority_score === 2 ? 'bg-primary' :
                selectedTask?.priority_score === 1 ? 'bg-muted-foreground' :
                'bg-secondary'
              }`} />
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {selectedTask.source_provider === 'canvas' && (
                  <Badge variant="secondary" className="bg-transparent border-0">
                    Canvas
                  </Badge>
                )}
                {selectedTask.event_type === 'assignment' && (
                  <Badge variant="secondary" className="bg-transparent border-0">
                    Assignment
                  </Badge>
                )}
                {selectedTask.course_name && (
                  <Badge variant="secondary" className="bg-transparent border-0">
                    {selectedTask.course_name}
                  </Badge>
                )}
                <Badge 
                  variant={getPriorityColor(selectedTask.priority_score || 2)}
                >
                  {getPriorityLabel(selectedTask.priority_score || 2)} Priority
                </Badge>
              </div>


              {/* Task Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Due Date & Time</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {selectedTask.due_date 
                        ? (() => {
                            const date = new Date(selectedTask.due_date);
                            if (selectedTask.source_provider === 'canvas' && selectedTask.due_date.includes('23:59:59+00')) {
                              const fixedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                              return format(fixedDate, "PPP 'at' hh:mm a");
                            }
                            return format(date, "PPP 'at' hh:mm a");
                          })()
                        : "No due date set"
                      }
                    </span>
                  </div>
                </div>
                
                {selectedTask.estimated_hours && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Estimated Time</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4" />
                      <span>{selectedTask.estimated_hours} hours</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              {(selectedTask.is_recurring || selectedTask.source_provider) && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Additional Information</h4>
                  <div className="space-y-2">
                    {selectedTask.is_recurring && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          Recurring {selectedTask.recurrence_type || 'task'}
                          {selectedTask.recurrence_type === 'weekly' && selectedTask.recurrence_pattern?.days 
                            ? ` on ${selectedTask.recurrence_pattern.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                            : ''
                          }
                        </span>
                      </div>
                    )}
                    {selectedTask.source_provider && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>Source: {selectedTask.source_provider}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Due This Week Modal */}
      <Dialog open={isDueThisWeekOpen} onOpenChange={setIsDueThisWeekOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Due This Week ({(() => { console.log('🔧 Accessing allDueThisWeek.length:', allDueThisWeek?.length); return allDueThisWeek?.length || 0; })()} items)
            </DialogTitle>
            <DialogDescription>
              All assignments and tasks due by the end of this week
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Pending Tasks Section */}
            <div>
              <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pending ({allDueThisWeek.length} items)
              </h3>
              <div className="space-y-3">
                {allDueThisWeek.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                    <p className="text-lg font-medium">Nothing due this week!</p>
                    <p className="text-muted-foreground">You're all caught up.</p>
                  </div>
                ) : (
                  allDueThisWeek.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{item.title}</h4>
                          <Badge variant={item.type === 'event' ? 'secondary' : 'outline'}>
                            {item.type === 'event' ? 'Assignment' : 'Task'}
                          </Badge>
                          {item.source !== 'Manual' && (
                            <Badge variant="outline" className="text-xs">
                              {item.source}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {(() => {
                              if (!item.due_date) return 'No due date';
                              const date = new Date(item.due_date);
                              return !isNaN(date.getTime()) ? format(date, "MMM dd, yyyy 'at' h:mm a") : 'Invalid date';
                            })()}
                          </div>
                          {item.course_name && item.course_name !== 'No Course' && (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {item.course_name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {new Date(item.due_date) < new Date() && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                        {new Date(item.due_date).toDateString() === new Date().toDateString() && (
                          <Badge variant="secondary" className="text-xs">
                            Due Today
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Completed Tasks Section */}
            {allCompletedToday.length > 0 && (
              <div>
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  Completed Today ({allCompletedToday.length} items)
                </h3>
                <div className="space-y-3">
                  {allCompletedToday.map((item) => (
                    <div key={`completed-${item.type}-${item.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 opacity-75">
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium line-through">{item.title}</h4>
                          <Badge variant={item.type === 'assignment' ? 'secondary' : 'outline'}>
                            {item.type === 'assignment' ? 'Assignment' : 'Task'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Completed {(() => {
                              if (!item.completed_at) return 'unknown time';
                              const date = new Date(item.completed_at);
                              return !isNaN(date.getTime()) ? format(date, "h:mm a") : 'invalid time';
                            })()}
                          </div>
                          {item.course_name && item.course_name !== 'No Course' && (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {item.course_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Progress Groups Section */}
      <div className="mt-8 space-y-6">
        <h2 className="text-2xl font-bold">Weekly Progress Overview</h2>
        
        {/* DEBUG: Show exact incomplete assignments */}
        <DebugWeeklyProgress userTasks={userTasks} userEvents={userEvents} />
        
        {/* Current Week - Detailed View */}
        <WeeklyProgressCard 
          weekGroup={weeklyProgressData.currentWeek} 
          showAssignments={true}
        />
        
        {/* Previous Weeks */}
        {weeklyProgressData.previousWeeks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Previous Weeks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeklyProgressData.previousWeeks.map((week, index) => (
                <WeeklyProgressCard key={index} weekGroup={week} />
              ))}
            </div>
          </div>
        )}
        
        {/* Upcoming Weeks */}
        {weeklyProgressData.upcomingWeeks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Upcoming Weeks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeklyProgressData.upcomingWeeks.map((week, index) => (
                <WeeklyProgressCard key={index} weekGroup={week} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};