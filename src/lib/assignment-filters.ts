/**
 * Centralized filtering for Canvas assignments and tasks
 * Ensures consistent filtering across all components
 */

export interface TaskOrEvent {
  id: string;
  title: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  event_type?: string;
  source_provider?: string;
  completion_status?: string;
  is_completed?: boolean;
  description?: string;
  course_name?: string;
  priority_score?: number;
}

/**
 * Filter out assignments that are more than a week overdue
 * This is the single source of truth for assignment filtering
 */
export const filterRecentAssignments = (items: TaskOrEvent[]): TaskOrEvent[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return items.filter(item => {
    // For Canvas assignments (events)
    if (item.source_provider === 'canvas' && item.event_type === 'assignment') {
      const eventDate = new Date(item.start_time || item.end_time || item.due_date || '');
      
      // Filter out assignments more than a week old
      if (eventDate < oneWeekAgo) {
        console.log(`FILTERING OUT old assignment: "${item.title}" due ${eventDate.toDateString()}`);
        return false;
      }
      return true;
    }
    
    // For manual tasks
    if (item.due_date && !item.source_provider) {
      const dueDate = new Date(item.due_date);
      
      // Filter out tasks more than a week old
      if (dueDate < oneWeekAgo) {
        console.log(`FILTERING OUT old task: "${item.title}" due ${dueDate.toDateString()}`);
        return false;
      }
      return true;
    }
    
    // Keep everything else
    return true;
  });
};

/**
 * Filter Canvas assignments specifically
 */
export const filterCanvasAssignments = (events: TaskOrEvent[]): TaskOrEvent[] => {
  const canvasAssignments = events.filter(event => 
    event.event_type === 'assignment' && event.source_provider === 'canvas'
  );
  
  return filterRecentAssignments(canvasAssignments);
};
