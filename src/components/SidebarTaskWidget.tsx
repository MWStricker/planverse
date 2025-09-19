import React, { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getPriorityBadgeVariant, analyzeTextForPriority } from "@/lib/priority-utils";
import { filterRecentAssignments } from "@/lib/assignment-filters";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  course_name?: string;
  completion_status: string;
  priority_score?: number;
  source_provider?: string;
  event_type?: string;
  type?: string;
  priority?: number;
}

interface SidebarTaskWidgetProps {
  isCollapsed?: boolean;
}

export const SidebarTaskWidget = ({ isCollapsed = false }: SidebarTaskWidgetProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTasksAndEvents = async () => {
    if (!user) return;

    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
      } else {
        setTasks(tasksData || []);
      }

      // Fetch relevant events (assignments, exams, etc.)
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
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskCompletion = async (taskId: string, currentStatus: string, isEvent: boolean = false) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    try {
      if (isEvent) {
        const { error } = await supabase
          .from('events')
          .update({ is_completed: newStatus === 'completed' })
          .eq('id', taskId);

        if (error) {
          console.error('Error updating event:', error);
          toast({
            title: "Error",
            description: "Failed to update assignment status",
            variant: "destructive",
          });
          return;
        }

        setEvents(events.map(event => 
          event.id === taskId 
            ? { ...event, is_completed: newStatus === 'completed' }
            : event
        ));
      } else {
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
          return;
        }

        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, completion_status: newStatus }
            : task
        ));
      }

      // Visual feedback
      setCompletingTasks(prev => new Set(prev).add(taskId));
      setTimeout(() => {
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }, 1000);

      toast({
        title: "Updated",
        description: `${isEvent ? 'Assignment' : 'Task'} marked as ${newStatus}`,
      });

      // Notify other components to refresh
      window.dispatchEvent(new CustomEvent('dataRefresh'));
      
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  useEffect(() => {
    fetchTasksAndEvents();
  }, [user]);

  // Listen for data refresh events
  useEffect(() => {
    const handleDataRefresh = () => {
      fetchTasksAndEvents();
    };

    window.addEventListener('dataRefresh', handleDataRefresh);
    return () => {
      window.removeEventListener('dataRefresh', handleDataRefresh);
    };
  }, []);

  if (loading || isCollapsed) {
    return null;
  }

  // Combine and process tasks and events
  const allItems = [
    ...tasks.map(task => ({
      ...task,
      type: 'task' as const,
      priority: task.priority_score !== null && task.priority_score !== undefined 
        ? task.priority_score 
        : analyzeTextForPriority(task.title, task.description || '')
    })),
    ...events.map(event => ({
      ...event,
      type: 'event' as const,
      due_date: event.start_time,
      completion_status: event.is_completed ? 'completed' : 'pending',
      priority: analyzeTextForPriority(event.title || '', event.description || '')
    }))
  ];

  // Filter recent assignments
  const recentItems = filterRecentAssignments(allItems);

  // Sort to prioritize recent assignments that need doing
  const sortedItems = recentItems.sort((a, b) => {
    // Pending tasks first
    if (a.completion_status !== b.completion_status) {
      if (a.completion_status === 'completed' && b.completion_status === 'pending') return 1;
      if (a.completion_status === 'pending' && b.completion_status === 'completed') return -1;
    }
    
    // For pending tasks, prioritize by recency and priority
    if (a.completion_status === 'pending' && b.completion_status === 'pending') {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const aIsRecent = a.due_date && new Date(a.due_date) <= sevenDaysFromNow && new Date(a.due_date) >= now;
      const bIsRecent = b.due_date && new Date(b.due_date) <= sevenDaysFromNow && new Date(b.due_date) >= now;
      
      if (aIsRecent && !bIsRecent) return -1;
      if (!aIsRecent && bIsRecent) return 1;
      
      const aPriority = 'priority' in a ? Number(a.priority || 0) : 0;
      const bPriority = 'priority' in b ? Number(b.priority || 0) : 0;
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
    }
    
    // Sort by due date
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    
    return 0;
  });

  // Show only the top 5 most relevant items
  const displayItems = sortedItems.slice(0, 5);
  const pendingItems = displayItems.filter(item => item.completion_status === 'pending');
  const completedItems = displayItems.filter(item => item.completion_status === 'completed');

  return (
    <div className="space-y-3">
      {/* Pending Tasks */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tasks Due
          </h4>
          {pendingItems.map((item) => (
            <div 
              key={item.id}
              className={`p-2 bg-muted/30 rounded-lg border transition-all duration-200 ${
                completingTasks.has(item.id) ? 'bg-green-100 dark:bg-green-900/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {item.title}
                  </p>
                  {item.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(item.due_date), 'MMM d')}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={() => toggleTaskCompletion(item.id, item.completion_status, 'type' in item && item.type === 'event')}
                >
                  <CheckCircle className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Tasks */}
      {completedItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Recently Completed
          </h4>
          {completedItems.map((item) => (
            <div 
              key={item.id}
              className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 truncate line-through">
                    {item.title}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Completed
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-muted/30"
                  onClick={() => toggleTaskCompletion(item.id, item.completion_status, 'type' in item && item.type === 'event')}
                >
                  <Clock className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingItems.length === 0 && completedItems.length === 0 && (
        <div className="text-center py-4">
          <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
          <p className="text-xs text-muted-foreground">All caught up!</p>
        </div>
      )}
    </div>
  );
};