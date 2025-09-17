import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval } from 'date-fns';
import { filterRecentAssignments } from '@/lib/assignment-filters';
import type { WeeklyGroup, WeeklyAssignment, WeeklyProgressData } from '@/types/weeklyProgress';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  completion_status?: string;
  course_name?: string;
  priority_score?: number;
}

interface Event {
  id: string;
  title: string;
  start_time?: string;
  end_time?: string;
  due_date?: string;
  event_type?: string;
  source_provider?: string;
  is_completed?: boolean;
  course_name?: string;
}

export const useWeeklyProgress = (userTasks: Task[], userEvents: Event[]) => {
  return useMemo(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });

    // Helper function to create a weekly group
    const createWeeklyGroup = (weekStart: Date, weekEnd: Date): WeeklyGroup => {
      const assignments: WeeklyAssignment[] = [];
      
      // Use EXACTLY the same logic as Smart Priority Queue and "Due This Week" tab
      const now = new Date();
      
      // Add manual tasks (same filtering as Smart Priority Queue)
      userTasks.forEach(task => {
        if (!task.due_date) return;
        
        const dueDate = new Date(task.due_date);
        // Only include tasks that are due in the future (same as Smart Priority Queue)
        if (isWithinInterval(dueDate, { start: weekStart, end: weekEnd }) && dueDate >= now) {
          assignments.push({
            id: task.id,
            title: task.title,
            dueDate,
            isCompleted: task.completion_status === 'completed',
            source: 'manual',
            courseCode: task.course_name,
            priority: task.priority_score || 0
          });
        }
      });

      // Add Canvas assignments (same filtering as Smart Priority Queue)
      const filteredCanvasEvents = filterRecentAssignments(userEvents);
      filteredCanvasEvents.forEach(event => {
        if (event.event_type !== 'assignment') return;
        
        const eventDate = new Date(event.start_time || event.end_time || event.due_date || '');
        // Only include assignments that are due in the future and within this week
        if (isWithinInterval(eventDate, { start: weekStart, end: weekEnd }) && eventDate >= now) {
          assignments.push({
            id: event.id,
            title: event.title,
            dueDate: eventDate,
            isCompleted: event.is_completed || false,
            source: 'canvas',
            courseCode: event.course_name,
            priority: 1 // Default priority for Canvas assignments
          });
        }
      });

      // Sort assignments by due date
      assignments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      const completedCount = assignments.filter(a => a.isCompleted).length;
      const totalCount = assignments.length;
      const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        weekStart,
        weekEnd,
        assignments,
        totalCount,
        completedCount,
        progressPercentage,
        isCurrentWeek: weekStart.getTime() === currentWeekStart.getTime()
      };
    };

    // Create current week
    const currentWeek = createWeeklyGroup(currentWeekStart, currentWeekEnd);

    // Create previous weeks (last 4 weeks)
    const previousWeeks: WeeklyGroup[] = [];
    for (let i = 1; i <= 4; i++) {
      const weekStart = subWeeks(currentWeekStart, i);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekGroup = createWeeklyGroup(weekStart, weekEnd);
      if (weekGroup.totalCount > 0) {
        previousWeeks.push(weekGroup);
      }
    }

    // Create upcoming weeks (next 4 weeks)
    const upcomingWeeks: WeeklyGroup[] = [];
    for (let i = 1; i <= 4; i++) {
      const weekStart = addWeeks(currentWeekStart, i);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekGroup = createWeeklyGroup(weekStart, weekEnd);
      if (weekGroup.totalCount > 0) {
        upcomingWeeks.push(weekGroup);
      }
    }

    console.log('📊 WEEKLY PROGRESS GROUPS:');
    console.log('- Current week:', format(currentWeek.weekStart, 'MMM d'), '-', format(currentWeek.weekEnd, 'MMM d'));
    console.log('- Current week progress:', `${currentWeek.completedCount}/${currentWeek.totalCount} (${currentWeek.progressPercentage}%)`);
    console.log('- Current week assignments:', currentWeek.assignments.map(a => `"${a.title}" (${a.isCompleted ? 'completed' : 'pending'})`));

    return {
      currentWeek,
      previousWeeks,
      upcomingWeeks
    } as WeeklyProgressData;
  }, [userTasks, userEvents]);
};