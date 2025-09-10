import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertTriangle, BookOpen, Calendar, Plus, Filter, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

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
}

const PRIORITY_KEYWORDS = {
  critical: ['exam', 'test', 'quiz', 'midterm', 'final'],
  high: ['assignment', 'project', 'presentation', 'paper', 'essay'],
  medium: ['homework', 'reading', 'discussion', 'lab'],
  low: ['optional', 'extra credit', 'review']
};

export const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const { user } = useAuth();
  const { toast } = useToast();

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
    
    // Default priority based on due date proximity
    if (dueDate) {
      const now = new Date();
      const due = new Date(dueDate);
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 1) return 4; // Critical - due tomorrow or today
      if (daysUntilDue <= 3) return 3; // High - due within 3 days
      if (daysUntilDue <= 7) return 2; // Medium - due within a week
    }
    
    return 2; // Default medium priority
  };

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

  const getPriorityIcon = (priority: number) => {
    switch (priority) {
      case 4: return <AlertTriangle className="h-4 w-4" />;
      case 3: return <Clock className="h-4 w-4" />;
      case 2: return <BookOpen className="h-4 w-4" />;
      case 1: return <CheckCircle className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
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
        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, completion_status: newStatus }
            : task
        ));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Combine and sort tasks by priority and due date
  const allItems = [
    ...tasks.map(task => ({
      ...task,
      type: 'task',
      priority: task.priority_score || calculatePriority(task.title, task.description, task.due_date)
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
    
    const matchesStatus = filterStatus === 'all' || item.completion_status === filterStatus;
    
    const matchesPriority = filterPriority === 'all' || 
                           getPriorityLabel(item.priority).toLowerCase() === filterPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort by priority (critical first) then by due date
  const sortedItems = filteredItems.sort((a, b) => {
    // First sort by priority (higher priority first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    
    // Then sort by due date (earlier dates first)
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
        <Button className="bg-gradient-to-r from-primary to-accent text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
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
          sortedItems.map((item) => (
            <Card key={`${item.type}-${item.id}`} className={`transition-all hover:shadow-md ${item.completion_status === 'completed' ? 'opacity-60' : ''}`}>
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
                      </h3>
                      <Badge variant={getPriorityColor(item.priority)} className="flex items-center gap-1">
                        {getPriorityIcon(item.priority)}
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
                        <span>Source: {item.source_provider}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};