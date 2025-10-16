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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatSourceProvider } from "@/lib/utils";
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
  analyzeTextForPriority,
  getPriorityBadgeVariant, 
  getPriorityIconComponent,
  getPriorityEmoji,
  PRIORITY_CONFIG
} from "@/lib/priority-utils";
import { PastDueAssignments } from "@/components/PastDueAssignments";

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
  completed_at?: string;
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
  priority: z.enum(["none", "low", "medium", "high"], {
    required_error: "Priority is required",
  }),
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["daily", "weekly", "monthly"]).optional(),
  recurrence_days: z.array(z.number()).optional(),
});


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

  // Function to calculate priority based on keywords and due date
  const calculatePriority = (title: string, description: string = '', dueDate?: string): number => {
    // Use the centralized priority analysis function
    return analyzeTextForPriority(title, description);
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
        console.log('📋 DEBUG: All fetched tasks:', tasksData);
        console.log('📋 DEBUG: Google tasks count:', tasksData?.filter(t => t.source_provider === 'google').length || 0);
        console.log('📋 DEBUG: Manual tasks count:', tasksData?.filter(t => t.source_provider === 'manual').length || 0);
        console.log('📋 DEBUG: Canvas tasks count:', tasksData?.filter(t => t.source_provider === 'canvas').length || 0);
        
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
        form.reset();
        fetchTasks(); // Refresh tasks
        
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

  const toggleTaskCompletion = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    // Prevent double clicks
    if (completingTasks.has(taskId)) {
      return;
    }

    // Immediately update UI for instant feedback
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              completion_status: newStatus,
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null
            }
          : task
      )
    );

    // Add visual feedback
    setCompletingTasks(prev => new Set(prev).add(taskId));
    
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
        // Revert the optimistic update on error
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { 
                  ...task, 
                  completion_status: currentStatus,
                  completed_at: currentStatus === 'completed' ? task.completed_at : null
                }
              : task
          )
        );
        toast({
          title: "Error",
          description: "Failed to update task status",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Task updated",
          description: `Task marked as ${newStatus}`,
        });
        
        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('dataRefresh'));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      // Revert the optimistic update on error
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, completion_status: currentStatus }
            : task
        )
      );
    } finally {
      // Remove visual feedback after a delay
      setTimeout(() => {
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }, 800);
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
        
        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('dataRefresh'));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const getTaskCourseColor = (task: Task): string => {
    if (!task.course_name || !storedColors[task.course_name]) return '';
    const color = storedColors[task.course_name];
    return `border-l-4 border-l-[${color}]`;
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Fetch stored course colors
  useEffect(() => {
    if (!user?.id) return;

    const fetchStoredColors = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .eq('settings_type', 'course_colors')
        .maybeSingle();

      if (data?.settings_data) {
        setStoredColors(data.settings_data as Record<string, string>);
      }
    };

    fetchStoredColors();
  }, [user?.id]);

  // Get current date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Combine and filter current tasks (FILTER OUT PAST DUE ASSIGNMENTS)
  const allCurrentItems = [
    ...tasks.map(task => ({
      ...task,
      type: 'task',
      priority: task.priority_score !== null && task.priority_score !== undefined 
        ? task.priority_score 
        : calculatePriority(task.title, task.description, task.due_date)
    })).filter(task => {
      // Only filter out tasks that are more than a week past due
      if (!task.due_date) return true; // Keep tasks without due dates
      const dueDate = new Date(task.due_date);
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return dueDate >= oneWeekAgo; // Keep tasks due within the last week or in the future
    }),
    ...events.map(event => ({
      ...event,
      type: 'event',
      due_date: event.start_time,
      completion_status: 'pending',
      priority: calculatePriority(event.title, event.description, event.start_time)
    })).filter(event => {
      // Only filter out events that are more than a week past due
      if (!event.start_time) return true; // Keep events without start times
      const eventDate = new Date(event.start_time);
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return eventDate >= oneWeekAgo; // Keep events due within the last week or in the future
    })
  ];

  // Filter and search current items
  const filteredCurrentItems = allCurrentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Always show recently toggled tasks regardless of filter status
    const isRecentlyToggled = completingTasks.has(item.id);
    const matchesStatus = filterStatus === 'all' || item.completion_status === filterStatus || isRecentlyToggled;
    
    const matchesPriority = filterPriority === 'all' || 
                           getPriorityLabel(item.priority).toLowerCase() === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort current items: pending tasks first (sorted by recent due dates), then completed tasks
  const sortedCurrentItems = filteredCurrentItems.sort((a, b) => {
    // First sort by completion status (pending tasks first, completed tasks last)
    if (a.completion_status !== b.completion_status) {
      if (a.completion_status === 'completed' && b.completion_status === 'pending') return 1;
      if (a.completion_status === 'pending' && b.completion_status === 'completed') return -1;
    }
    
    // For pending tasks, sort by due date (most recent/urgent first)
    if (a.completion_status === 'pending' && b.completion_status === 'pending') {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
    }
    
    // For completed tasks, sort by completion date (most recently completed first)
    if (a.completion_status === 'completed' && b.completion_status === 'completed') {
      if (a.due_date && b.due_date) {
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      }
    }
    
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
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Current Tasks
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="past-due" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Past Due
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          {/* Add Task Button */}
          <div className="flex justify-end">
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
                          <FormControl>
                            <Input 
                              placeholder="Enter course name..." 
                              autoComplete="off" 
                              {...field} 
                            />
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
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return date < today;
                                  }}
                                  initialFocus
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
                                {Array.from({ length: 96 }, (_, i) => {
                                  const hour = Math.floor(i / 4);
                                  const minute = (i % 4) * 15;
                                  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                  const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
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

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
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

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="task-search"
                      name="task-search"
                      placeholder="Search current tasks..."
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
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">High Priority</p>
                    <p className="text-xl font-bold">{sortedCurrentItems.filter(item => item.priority === 3 && item.completion_status === 'pending').length}</p>
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
                    <p className="text-xl font-bold">{sortedCurrentItems.filter(item => item.completion_status === 'pending').length}</p>
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
                    <p className="text-xl font-bold">{sortedCurrentItems.filter(item => item.completion_status === 'completed').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Tasks */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Pending Tasks</h2>
              <div className="space-y-3">
                {sortedCurrentItems.filter(item => item.completion_status === 'pending').length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-muted-foreground">All tasks completed! Great job!</p>
                    </CardContent>
                  </Card>
                ) : (
                  sortedCurrentItems
                    .filter(item => item.completion_status === 'pending')
                    .map((item) => {
                      const taskCourseColor = item.type === 'task' ? getTaskCourseColor(item as Task) : '';
                      return (
                        <Card key={`${item.type}-${item.id}`} className={`transition-all hover:shadow-md ${taskCourseColor}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => item.type === 'task' ? toggleTaskCompletion(item.id, item.completion_status) : convertEventToTask(item)}
                                className="flex-shrink-0 hover:bg-green-50 transition-all duration-200"
                              >
                                {item.type === 'event' ? (
                                  <Plus className="h-5 w-5 text-blue-500 hover:text-blue-600" />
                                ) : (
                                  <div className="h-5 w-5 border-2 border-muted-foreground rounded hover:border-green-500 hover:bg-green-100 transition-all duration-200 relative group">
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <CheckCircle className="h-5 w-5 text-green-500" />
                                    </div>
                                  </div>
                                )}
                              </Button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className={`font-medium transition-all duration-300 ${
                                    completingTasks.has(item.id) 
                                      ? 'text-green-600 animate-pulse' 
                                      : 'text-foreground'
                                  }`}>
                                    {item.title}
                                    {completingTasks.has(item.id) && (
                                      <span className="ml-2 text-green-600 font-semibold animate-bounce">✓ Completing...</span>
                                    )}
                                  </h3>
                                  <Badge variant={getPriorityBadgeVariant(item.priority)} className={`flex items-center gap-1 ${getPriorityConfig(item.priority).bgColor} ${getPriorityConfig(item.priority).textColor} ${getPriorityConfig(item.priority).borderColor}`}>
                                    {React.createElement(getPriorityIconComponent(item.priority), { className: "h-4 w-4" })}
                                    {getPriorityLabel(item.priority)}
                                  </Badge>
                                  {item.type === 'event' && (
                                    <Badge variant="outline">From Calendar</Badge>
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
                                    <span>Source: {formatSourceProvider(item.source_provider)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            {sortedCurrentItems.filter(item => item.completion_status === 'completed').length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">Completed Tasks</h2>
                <div className="space-y-3">
                  {sortedCurrentItems
                    .filter(item => item.completion_status === 'completed')
                    .map((item) => {
                      const taskCourseColor = item.type === 'task' ? getTaskCourseColor(item as Task) : '';
                      return (
                        <Card key={`${item.type}-${item.id}`} className={`transition-all hover:shadow-md opacity-60 ${
                          completingTasks.has(item.id) ? 'bg-green-50 border-green-200 animate-pulse' : ''
                        } ${taskCourseColor}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTaskCompletion(item.id, item.completion_status)}
                                className="flex-shrink-0 hover:bg-red-50 transition-all duration-200"
                                title="Mark as pending"
                              >
                                <CheckCircle className="h-5 w-5 text-green-500 hover:text-green-600" />
                              </Button>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium line-through text-muted-foreground">
                                    {item.title}
                                    {completingTasks.has(item.id) && (
                                      <span className="ml-2 text-green-600 font-semibold animate-bounce">✓ Completed!</span>
                                    )}
                                  </h3>
                                  <Badge variant={getPriorityBadgeVariant(item.priority)} className={`flex items-center gap-1 ${getPriorityConfig(item.priority).bgColor} ${getPriorityConfig(item.priority).textColor} ${getPriorityConfig(item.priority).borderColor}`}>
                                    {React.createElement(getPriorityIconComponent(item.priority), { className: "h-4 w-4" })}
                                    {getPriorityLabel(item.priority)}
                                  </Badge>
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
                                    <span>Source: {formatSourceProvider(item.source_provider)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-6">
          {(() => {
            // Get all completed tasks
            const completedTasks = allCurrentItems.filter(item => 
              item.completion_status === 'completed'
            );

            // Debug: Log the completed tasks to see their structure
            console.log('DEBUG - Completed tasks:', completedTasks.map(t => ({
              title: t.title,
              completed_at: t.completed_at,
              due_date: t.due_date,
              created_at: t.created_at,
              completion_status: t.completion_status
            })));

            // Group tasks by completion date (or due date if no completion date)
            const groupedByDate = completedTasks.reduce((groups, task) => {
              let dateToUse;
              
              // For completed tasks, prioritize completed_at, then due_date, then created_at
              if (task.completed_at) {
                dateToUse = task.completed_at;
              } else if (task.due_date) {
                dateToUse = task.due_date;
              } else {
                dateToUse = task.created_at;
              }
              
              // Extract just the date part (YYYY-MM-DD) to group by day
              const dateStr = dateToUse ? format(new Date(dateToUse), 'yyyy-MM-dd') : 'no-date';
              
              if (!groups[dateStr]) {
                groups[dateStr] = [];
              }
              groups[dateStr].push(task);
              return groups;
            }, {} as Record<string, typeof completedTasks>);

            // Sort dates with today first, then descending order
            const today = format(new Date(), 'yyyy-MM-dd');
            const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
              if (a === today) return -1;
              if (b === today) return 1;
              return b.localeCompare(a); // Descending order
            });

            if (completedTasks.length === 0) {
              return (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No completed tasks yet</h3>
                  <p className="text-sm text-muted-foreground">Complete some tasks to see them here!</p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {sortedDates.map(dateStr => {
                  const tasksForDate = groupedByDate[dateStr];
                  const isToday = dateStr === today;
                  const displayDate = dateStr === 'no-date' ? 'No Date' : 
                    isToday ? 'Today' : format(new Date(dateStr), 'EEEE, MMMM d, yyyy');

                  return (
                    <div key={dateStr} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <h3 className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {displayDate}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {tasksForDate.length} task{tasksForDate.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="grid gap-3">
                        {tasksForDate
                          .sort((a, b) => {
                            // Sort by completion time or due time within each day
                            const timeA = a.completed_at || a.due_date || a.created_at;
                            const timeB = b.completed_at || b.due_date || b.created_at;
                            if (!timeA || !timeB) return 0;
                            return new Date(timeB).getTime() - new Date(timeA).getTime();
                          })
                          .map((task) => {
                            const PriorityIcon = getPriorityIconComponent(task.priority);
                            
                            return (
                              <Card
                                key={task.id}
                                className={cn(
                                  "transition-all duration-200 hover:shadow-md",
                                  getTaskCourseColor(task),
                                  "opacity-75"
                                )}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 mt-0.5 flex-shrink-0">
                                        <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <h4 className={cn(
                                            "font-medium text-sm text-foreground leading-tight line-through decoration-2"
                                          )}>
                                            {task.title}
                                          </h4>
                                          <div className="flex items-center gap-1">
                                            <PriorityIcon className="h-3 w-3" />
                                            <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-xs h-4 px-2">
                                              {getPriorityLabel(task.priority)} {getPriorityEmoji(task.priority)}
                                            </Badge>
                                          </div>
                                          {task.source_provider && (
                                            <Badge variant="outline" className="text-xs h-4 px-2 capitalize">
                                              {formatSourceProvider(task.source_provider)}
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                        
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                          {task.due_date && (
                                            <div className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              <span>Due: {format(new Date(task.due_date), "MMM d, h:mm a")}</span>
                                            </div>
                                          )}
                                          {task.completed_at && (
                                            <div className="flex items-center gap-1">
                                              <CheckCircle className="h-3 w-3" />
                                              <span>Completed: {format(new Date(task.completed_at), "MMM d, h:mm a")}</span>
                                            </div>
                                          )}
                                          {task.course_name && (
                                            <div className="flex items-center gap-1">
                                              <BookOpen className="h-3 w-3" />
                                              <span className="truncate">{task.course_name}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="past-due">
          <PastDueAssignments />
        </TabsContent>
      </Tabs>
    </div>
  );
};