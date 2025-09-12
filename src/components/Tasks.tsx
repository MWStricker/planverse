import React, { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertTriangle, BookOpen, Calendar, Plus, Filter, Search, CalendarIcon, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  getPriorityConfig, 
  getPriorityLabel, 
  getPriorityBadgeVariant, 
  getPriorityIconComponent,
  getPriorityEmoji,
  PRIORITY_CONFIG 
} from "@/lib/priority-utils";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  course_name?: string;
  completion_status: string;
  priority_score?: number;
  source_provider?: string;
  created_at: string;
  event_type?: string;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_pattern?: any;
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  course_name: z.string().optional(),
  due_date: z.date({
    required_error: "Due date is required",
    invalid_type_error: "Please select a valid date",
  }),
  due_time: z.string().min(1, "Time is required"),
  priority: z.enum(["none", "low", "medium", "high", "critical"], {
    required_error: "Priority is required",
  }),
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["daily", "weekly", "monthly"]).optional(),
  recurrence_days: z.array(z.number()).optional(),
});

const PRIORITY_KEYWORDS = {
  critical: ['exam', 'test', 'quiz', 'midterm', 'final'],
  high: ['assignment', 'project', 'presentation', 'paper', 'essay'],
  medium: ['homework', 'reading', 'discussion', 'lab'],
  low: ['optional', 'extra credit', 'review']
};

export const Tasks = () => {
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      course_name: "",
      due_date: new Date(),
      due_time: "12:00",
      priority: "none",
      is_recurring: false,
      recurrence_type: undefined,
      recurrence_days: undefined,
    },
  });

  const onSubmitTask = async (values: z.infer<typeof taskFormSchema>) => {
    if (!user) return;

    // Combine date and time
    const dueDateTime = new Date(values.due_date);
    const [hours, minutes] = values.due_time.split(':');
    dueDateTime.setHours(parseInt(hours), parseInt(minutes));

    // Use keyword-based priority calculation instead of form priority
    const calculatedPriority = calculatePriority(values.title, values.description || '', dueDateTime.toISOString());

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: values.title,
          description: values.description || null,
          course_name: values.course_name || null,
          due_date: dueDateTime.toISOString(),
          priority_score: calculatedPriority,
          completion_status: 'pending',
          source_provider: 'manual',
          is_recurring: values.is_recurring || false,
          recurrence_type: values.recurrence_type || null,
          recurrence_pattern: values.recurrence_days ? { days: values.recurrence_days } : null,
        })
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
          description: "Task created successfully",
        });
        setIsAddDialogOpen(false);
        resetForm();
        fetchTasks(); // Refresh tasks
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

  const getNextRecurrences = (task: any, count: number = 3) => {
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

  const onEditTask = async (values: z.infer<typeof taskFormSchema>) => {
    if (!user || !editingTask) return;

    // Combine date and time
    const dueDateTime = new Date(values.due_date);
    const [hours, minutes] = values.due_time.split(':');
    dueDateTime.setHours(parseInt(hours), parseInt(minutes));

    // Use keyword-based priority calculation for edited tasks too
    const calculatedPriority = calculatePriority(values.title, values.description || '', dueDateTime.toISOString());

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: values.title,
          description: values.description || null,
          course_name: values.course_name || null,
          due_date: dueDateTime.toISOString(),
          priority_score: calculatedPriority,
          is_recurring: values.is_recurring || false,
          recurrence_type: values.recurrence_type || null,
          recurrence_pattern: values.recurrence_days ? { days: values.recurrence_days } : null,
        })
        .eq('id', editingTask.id);

      if (error) {
        console.error('Error updating task:', error);
        toast({
          title: "Error",
          description: "Failed to update task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Task updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingTask(null);
        form.reset();
        fetchTasks(); // Refresh tasks
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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    
    // Convert priority score back to string
    const priorityMap: { [key: number]: "none" | "low" | "medium" | "high" | "critical" } = {
      0: "none",
      1: "low",
      2: "medium", 
      3: "high",
      4: "critical"
    };

    // Parse due date and time
    let dueDate: Date | undefined;
    let dueTime = "12:00";
    
    if (task.due_date) {
      dueDate = new Date(task.due_date);
      dueTime = dueDate.toTimeString().slice(0, 5); // Get HH:MM format
    }

    form.reset({
      title: task.title,
      description: task.description || "",
      course_name: task.course_name || "",
      due_date: dueDate,
      due_time: dueTime,
      priority: priorityMap[task.priority_score || 0] || "none",
      is_recurring: task.is_recurring || false,
      recurrence_type: (task.recurrence_type as "daily" | "weekly" | "monthly") || undefined,
      recurrence_days: task.recurrence_pattern?.days || undefined,
    });
    
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    form.reset({
      title: "",
      description: "",
      course_name: "",
      due_date: new Date(),
      due_time: "12:00",
      priority: "none",
    });
    setEditingTask(null);
  };

  // Function to calculate priority based on keywords and due date
  const calculatePriority = (title: string, description: string = '', dueDate?: string): number => {
    const text = `${title} ${description}`.toLowerCase();
    
    // Check for critical keywords (exams, tests)
    if (PRIORITY_KEYWORDS.critical.some(keyword => text.includes(keyword))) {
      return 4; // Critical
    }
    
    // Check for high priority keywords
    if (PRIORITY_KEYWORDS.high.some(keyword => text.includes(keyword))) {
      return 3; // High
    }
    
    // Check for medium priority keywords
    if (PRIORITY_KEYWORDS.medium.some(keyword => text.includes(keyword))) {
      return 2; // Medium
    }
    
    // Check for low priority keywords
    if (PRIORITY_KEYWORDS.low.some(keyword => text.includes(keyword))) {
      return 1; // Low
    }
    
    // Only assign priority based on due date for urgent deadlines
    if (dueDate) {
      const now = new Date();
      const due = new Date(dueDate);
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 1) return 4; // Critical - due tomorrow or today
    }
    
    return 0; // Default no priority
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // Fetch tasks from database
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        toast({
          title: "Error",
          description: "Failed to fetch tasks from database",
          variant: "destructive",
        });
      } else {
        setTasks(tasksData || []);
      }

      // Fetch events that could be tasks (assignments, exams, etc.)
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['assignment', 'exam', 'quiz', 'project'])
        .order('start_time', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else {
        setEvents(eventsData || []);
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const convertEventToTask = async (event: any) => {
    if (!user) return;

    const priority = calculatePriority(event.title, event.description, event.start_time);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: event.title,
          description: event.description,
          due_date: event.start_time,
          source_provider: event.source_provider || 'calendar',
          source_assignment_id: event.source_event_id,
          priority_score: priority,
          event_type: event.event_type,
          completion_status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error converting event to task:', error);
        toast({
          title: "Error",
          description: "Failed to convert event to task",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Event converted to task successfully",
        });
        fetchTasks(); // Refresh tasks
      }
    } catch (error) {
      console.error('Unexpected error:', error);
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
        // Update local state
        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, completion_status: newStatus }
            : task
        ));

        // Briefly highlight the task that was just toggled
        setCompletingTasks(prev => new Set(prev).add(taskId));
        
        setTimeout(() => {
          setCompletingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }, 1000); // Remove highlight after 1 second
        
        toast({
          title: "Task updated",
          description: `Task marked as ${newStatus}`,
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    
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
        setIsEditDialogOpen(false);
        setEditingTask(null);
        fetchTasks(); // Refresh tasks
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

  // Helper function to get task course color
  const getTaskCourseColor = (task: Task) => {
    // Extract course code from course_name or title
    const courseCode = task.course_name || extractCourseCode(task.title);
    
    // First, try to use stored Canvas color
    if (courseCode && storedColors[courseCode]) {
      const color = storedColors[courseCode];
      return `border-l-4 border-l-[${color}] bg-[${color}]/5`;
    }
    
    // Fallback color mapping based on course type
    const colorMappings: Record<string, string> = {
      'HES': 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
      'LIFE': 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
      'LIFE-L': 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
      'MATH': 'border-l-amber-600 bg-amber-50 dark:bg-amber-900/10',
      'MU': 'border-l-green-500 bg-green-50 dark:bg-green-900/10',
      'PSY': 'border-l-red-500 bg-red-50 dark:bg-red-900/10',
    };
    
    if (courseCode) {
      // Direct match first
      if (colorMappings[courseCode]) {
        return colorMappings[courseCode];
      }
      
      // Pattern matching for course prefixes
      const prefix = courseCode.split('-')[0];
      if (colorMappings[prefix]) {
        return colorMappings[prefix];
      }
    }
    
    // Default color for tasks without course info
    return 'border-l-4 border-l-border bg-muted/20';
  };

  // Extract course code from title or course name
  const extractCourseCode = (title: string): string | null => {
    if (!title) return null;
    
    // Enhanced patterns for Canvas course extraction
    const patterns = [
      // [2025FA-PSY-100-007] or [2025FA-LIFE-102-003] format
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)\]/i,
      // [PSY-100-007-2025FA] format
      /\[([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)-(\d{4}[A-Z]{2})\]/i,
      // Simple course codes like PSY-100, MATH-118, LIFE-102, etc.
      /\b([A-Z]{2,4}-?\d{3,4}[A-Z]?)\b/i,
      // Lab courses like LIFE-102-L16
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}-?L\d*)\]/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        // Return the course code, cleaning up any extra formatting
        let courseCode = match[2] || match[1];
        // Remove semester info and normalize format
        courseCode = courseCode.replace(/\d{4}[A-Z]{2}/, '').replace(/^-|-$/, '');
        
        // Handle lab courses - keep the L designation but remove section numbers
        if (courseCode.includes('-L')) {
          courseCode = courseCode.replace(/-L\d+$/, '-L');
        }
        // If it's a regular course with section number, keep just the base course
        else if (courseCode.match(/^[A-Z]{2,4}-?\d{3,4}-\d{3}$/i)) {
          courseCode = courseCode.replace(/-\d{3}$/, '');
        }
        
        return courseCode.toUpperCase();
      }
    }
    
    return null;
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Listen for data refresh events from other components
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchTasks();
    };

    window.addEventListener('dataRefresh', handleDataRefresh);
    window.addEventListener('tasksCleared', handleDataRefresh);

    return () => {
      window.removeEventListener('dataRefresh', handleDataRefresh);
      window.removeEventListener('tasksCleared', handleDataRefresh);
    };
  }, [user]);

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

  // Combine and sort tasks by priority and due date
  const allItems = [
    ...tasks.map(task => ({
      ...task,
      type: 'task',
      priority: task.priority_score !== null && task.priority_score !== undefined 
        ? task.priority_score 
        : calculatePriority(task.title, task.description, task.due_date)
    })),
    ...events.map(event => ({
      ...event,
      type: 'event',
      due_date: event.start_time,
      completion_status: 'pending',
      priority: calculatePriority(event.title, event.description, event.start_time)
    }))
  ];

  // Filter and search
  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Always show recently toggled tasks regardless of filter status
    const isRecentlyToggled = completingTasks.has(item.id);
    const matchesStatus = filterStatus === 'all' || item.completion_status === filterStatus || isRecentlyToggled;
    
    const matchesPriority = filterPriority === 'all' || 
                           getPriorityLabel(item.priority).toLowerCase() === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort by completion status first (pending tasks first), then by priority, then by due date
  const sortedItems = filteredItems.sort((a, b) => {
    // First sort by completion status (pending tasks first, completed tasks last)
    if (a.completion_status !== b.completion_status) {
      if (a.completion_status === 'completed' && b.completion_status === 'pending') return 1;
      if (a.completion_status === 'pending' && b.completion_status === 'completed') return -1;
    }
    
    // Then sort by priority (higher priority first) - only for pending tasks
    if (a.completion_status === 'pending' && b.completion_status === 'pending') {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
    }
    
    // Finally sort by due date (earlier dates first)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    return 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Tasks & Assignments</h1>
          <p className="text-muted-foreground">
            Manage your tasks synced from connected integrations
          </p>
        </div>
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
              <form onSubmit={form.handleSubmit(onSubmitTask)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task title..." {...field} />
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
                      <FormControl>
                        <Input placeholder="Enter course name..." {...field} />
                      </FormControl>
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
                        <Popover onOpenChange={(open) => {
                          // If closing and no date selected, auto-select today
                          if (!open && !field.value) {
                            field.onChange(new Date());
                          }
                        }}>
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
                          <PopoverContent className="w-auto p-0 bg-popover border" align="start">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {/* Generate time options every 15 minutes */}
                            {Array.from({ length: 96 }, (_, i) => {
                              const hour = Math.floor(i / 4);
                              const minute = (i % 4) * 15;
                              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                              const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              });
                              return (
                                <SelectItem key={timeString} value={timeString}>
                                  {displayTime}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
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
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 border border-muted-foreground rounded" />
                              No Priority
                            </div>
                          </SelectItem>
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
                          <SelectItem value="critical">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              Critical Priority
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-primary to-accent text-white">
                    Create Task
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update task details, due date, time, and priority level.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEditTask)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task title..." {...field} />
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
                      <FormControl>
                        <Input placeholder="Enter course name..." {...field} />
                      </FormControl>
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
                          <PopoverContent className="w-auto p-0 bg-popover border" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                console.log('Date selected (edit):', date);
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {/* Generate time options every 15 minutes */}
                            {Array.from({ length: 96 }, (_, i) => {
                              const hour = Math.floor(i / 4);
                              const minute = (i % 4) * 15;
                              const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                              const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              });
                              return (
                                <SelectItem key={timeString} value={timeString}>
                                  {displayTime}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 border border-muted-foreground rounded" />
                              No Priority
                            </div>
                          </SelectItem>
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
                          <SelectItem value="critical">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              Critical Priority
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Recurring Task Section */}
                <FormField
                  control={form.control}
                  name="is_recurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Recurring Task</FormLabel>
                        <FormDescription>
                          Make this task repeat automatically
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
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <FormField
                      control={form.control}
                      name="recurrence_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat</FormLabel>
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

                    {form.watch("recurrence_type") === "weekly" && (
                      <FormField
                        control={form.control}
                        name="recurrence_days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Days</FormLabel>
                            <FormDescription>
                              Choose which days of the week to repeat
                            </FormDescription>
                            <div className="flex flex-wrap gap-2">
                              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                                <Button
                                  key={day}
                                  type="button"
                                  variant={field.value?.includes(index) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    const currentDays = field.value || [];
                                    const newDays = currentDays.includes(index)
                                      ? currentDays.filter(d => d !== index)
                                      : [...currentDays, index];
                                    field.onChange(newDays);
                                  }}
                                >
                                  {day}
                                </Button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="flex gap-2 sm:mr-auto">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => editingTask && deleteTask(editingTask.id)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Task
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-gradient-to-r from-primary to-accent text-white">
                      Update Task
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks and assignments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-xl font-bold">{sortedItems.filter(item => item.priority === 4 && item.completion_status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-xl font-bold">{sortedItems.filter(item => item.priority === 3 && item.completion_status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-xl font-bold">{sortedItems.filter(item => item.completion_status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-bold">{sortedItems.filter(item => item.completion_status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Connect your academic accounts in settings to sync assignments and events
              </p>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Go to Integrations
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedItems.map((item) => {
            const taskCourseColor = item.type === 'task' ? getTaskCourseColor(item as Task) : '';
            return (
              <Card key={`${item.type}-${item.id}`} className={`transition-all hover:shadow-md ${
                item.completion_status === 'completed' ? 'opacity-60' : ''
              } ${
                completingTasks.has(item.id) ? 'bg-green-50 border-green-200 animate-pulse' : ''
              } ${taskCourseColor}`}>
                <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => item.type === 'task' ? toggleTaskCompletion(item.id, item.completion_status) : convertEventToTask(item)}
                    className="flex-shrink-0"
                  >
                    {item.completion_status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : item.type === 'event' ? (
                      <Plus className="h-5 w-5" />
                    ) : (
                      <div className="h-5 w-5 border-2 border-muted-foreground rounded" />
                    )}
                  </Button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium ${item.completion_status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.title}
                        {completingTasks.has(item.id) && (
                          <span className="ml-2 text-green-600 font-semibold animate-bounce">✓ Completed!</span>
                        )}
                      </h3>
                      <Badge variant={getPriorityBadgeVariant(item.priority)} className={`flex items-center gap-1 ${getPriorityConfig(item.priority).bgColor} ${getPriorityConfig(item.priority).textColor} ${getPriorityConfig(item.priority).borderColor}`}>
                        {React.createElement(getPriorityIconComponent(item.priority), { className: "h-4 w-4" })}
                        {getPriorityLabel(item.priority)}
                      </Badge>
                      {item.type === 'event' && (
                        <Badge variant="outline">From Calendar</Badge>
                      )}
                      {item.is_recurring && (
                        <Badge variant="outline" className="text-xs">
                          Recurring
                        </Badge>
                      )}
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {item.course_name && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {item.course_name}
                        </span>
                      )}
                      {item.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {item.source_provider && (
                        <span>Source: {item.source_provider}</span>
                      )}
                    </div>

                    {item.is_recurring && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.recurrence_type === 'weekly' && item.recurrence_pattern?.days 
                          ? `Recurrs weekly on ${item.recurrence_pattern.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`
                          : `Recurrs ${item.recurrence_type}`
                        }
                      </div>
                    )}
                  </div>
                  
                  {/* Edit button for tasks (not events) */}
                  {item.type === 'task' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTask(item as Task)}
                      className="flex-shrink-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};