import React, { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertTriangle, BookOpen, Calendar, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatSourceProvider } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  getPriorityConfig, 
  getPriorityLabel, 
  getPriorityBadgeVariant, 
  getPriorityIconComponent,
  analyzeTextForPriority
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
}

export const PastDueAssignments = () => {
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPastDueData = async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch past due tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .lt('due_date', today.toISOString())
        .eq('completion_status', 'pending')
        .order('due_date', { ascending: false });

      if (tasksError) {
        console.error('Error fetching past due tasks:', tasksError);
      } else {
        setTasks(tasksData || []);
      }

      // Fetch past due events (assignments, exams, etc.)
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['assignment', 'exam', 'quiz', 'project'])
        .lt('start_time', today.toISOString())
        .neq('is_completed', true)
        .order('start_time', { ascending: false });

      if (eventsError) {
        console.error('Error fetching past due events:', eventsError);
      } else {
        setEvents(eventsData || []);
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching past due items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPastDueData();
  }, [user]);

  // Function to calculate priority based on keywords and due date
  const calculatePriority = (title: string, description: string = '', dueDate?: string): number => {
    // Use the centralized priority analysis function
    return analyzeTextForPriority(title, description);
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

        // Remove from view if completed
        if (newStatus === 'completed') {
          setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        }

        toast({
          title: "Task updated",
          description: `Task marked as ${newStatus}`,
        });
        
        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('dataRefresh'));
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const toggleEventCompletion = async (eventId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_completed: newStatus })
        .eq('id', eventId);

      if (error) {
        console.error('Error updating event:', error);
        toast({
          title: "Error",
          description: "Failed to update assignment status",
          variant: "destructive",
        });
      } else {
        // Remove from view if completed
        if (newStatus) {
          setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
        }

        toast({
          title: "Assignment updated",
          description: `Assignment marked as ${newStatus ? 'completed' : 'pending'}`,
        });
        
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

  // Combine and filter past due items
  const allPastDueItems = [
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

  // Filter by search and priority
  const filteredItems = allPastDueItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = filterPriority === 'all' || 
                           getPriorityLabel(item.priority).toLowerCase() === filterPriority;
    
    return matchesSearch && matchesPriority;
  });

  // Sort by due date (most recently overdue first)
  const sortedItems = filteredItems.sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
    }
    
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    return 0;
  });

  // Calculate days overdue
  const getDaysOverdue = (dueDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading past due assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Past Due Assignments</h2>
        <p className="text-muted-foreground">
          Assignments and tasks that are past their due date. Complete them to remove them from this list.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="past-due-search"
                  name="past-due-search"
                  placeholder="Search past due items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          <Select name="past-due-priority-filter" value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger id="past-due-priority-filter" className="w-40">
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
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Total Past Due</p>
                <p className="text-xl font-bold text-destructive">{sortedItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">High Priority Past Due</p>
                <p className="text-xl font-bold text-warning">{sortedItems.filter(item => item.priority === 3).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">From Canvas</p>
                <p className="text-xl font-bold">{sortedItems.filter(item => item.type === 'event').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Due Items List */}
      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
              <h3 className="text-lg font-medium text-foreground mb-2">No past due assignments!</h3>
              <p className="text-muted-foreground">
                Great job staying on top of your tasks! All assignments are up to date.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedItems.map((item) => {
            const taskCourseColor = item.type === 'task' ? getTaskCourseColor(item as Task) : '';
            const daysOverdue = item.due_date ? getDaysOverdue(item.due_date) : 0;
            
            return (
              <Card key={`${item.type}-${item.id}`} className={`transition-all hover:shadow-md border-l-4 border-l-destructive ${taskCourseColor}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => 
                        item.type === 'task' 
                          ? toggleTaskCompletion(item.id, item.completion_status)
                          : toggleEventCompletion(item.id, item.is_completed || false)
                      }
                      className="flex-shrink-0"
                    >
                      <div className="h-5 w-5 border-2 border-muted-foreground rounded" />
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">
                          {item.title}
                        </h3>
                        <Badge variant={getPriorityBadgeVariant(item.priority)} className={`flex items-center gap-1 ${getPriorityConfig(item.priority).bgColor} ${getPriorityConfig(item.priority).textColor} ${getPriorityConfig(item.priority).borderColor}`}>
                          {React.createElement(getPriorityIconComponent(item.priority), { className: "h-4 w-4" })}
                          {getPriorityLabel(item.priority)}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                        </Badge>
                        {item.type === 'event' && (
                          <span className="text-xs text-muted-foreground">From Canvas</span>
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
                            Was due: {new Date(item.due_date).toLocaleDateString()}
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
  );
};