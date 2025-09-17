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
    console.log('🔄 useWeeklyProgress HOOK TRIGGERED - FORCED UPDATE');
    console.log('- userTasks length:', userTasks.length);
    console.log('- userEvents length:', userEvents.length);
    console.log('- userEvents with is_completed=true:', userEvents.filter(e => e.is_completed).length);
    
    // Debug all Canvas assignments completion status
    const canvasAssignments = userEvents.filter(e => e.event_type === 'assignment');
    console.log('🎯 ALL CANVAS ASSIGNMENTS:');
    canvasAssignments.forEach((assignment, index) => {
      console.log(`  ${index + 1}. "${assignment.title}" - is_completed: ${assignment.is_completed} (ID: ${assignment.id})`);
    });
    
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday end
    
    console.log('📅 WEEK CALCULATION DEBUG:');
    console.log('- Today:', format(today, 'MMM d, yyyy (EEEE)'));
    console.log('- Current week start (Monday):', format(currentWeekStart, 'MMM d, yyyy (EEEE)'));
    console.log('- Current week end (Sunday):', format(currentWeekEnd, 'MMM d, yyyy (EEEE)'));

    // Helper function to create a weekly group
    const createWeeklyGroup = (weekStart: Date, weekEnd: Date): WeeklyGroup => {
      const assignments: WeeklyAssignment[] = [];
      
      // Use EXACTLY the same logic as Smart Priority Queue and "Due This Week" tab
      const now = new Date();
      
      // Add manual tasks (same filtering as Smart Priority Queue)
      userTasks.forEach(task => {
        if (!task.due_date) return;
        
        const dueDate = new Date(task.due_date);
        console.log(`🔍 Checking manual task: "${task.title}" due ${format(dueDate, 'MMM d, yyyy')} - in current week: ${isWithinInterval(dueDate, { start: weekStart, end: weekEnd })}`);
        // Include ALL tasks due this week (both completed and pending)
        if (isWithinInterval(dueDate, { start: weekStart, end: weekEnd })) {
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
      
      // Debug: Log week information for current week
      if (weekStart.getTime() === currentWeekStart.getTime()) {
        console.log('🔍 DEBUGGING CURRENT WEEK ASSIGNMENTS:');
        console.log('- Week range:', format(weekStart, 'MMM d'), 'to', format(weekEnd, 'MMM d'));
        console.log('- Now:', format(now, 'MMM d HH:mm'));
        console.log('- Total filtered Canvas events:', filteredCanvasEvents.length);
        
        let canvasAssignmentsInWeek = 0;
        let futureCanvasAssignments = 0;
        
        filteredCanvasEvents.forEach(event => {
          if (event.event_type !== 'assignment') return;
          
          const eventDate = new Date(event.start_time || event.end_time || event.due_date || '');
          const isInWeek = isWithinInterval(eventDate, { start: weekStart, end: weekEnd });
          const isFuture = eventDate >= now;
          
          if (isInWeek) {
            canvasAssignmentsInWeek++;
            console.log(`- Assignment in week: "${event.title}" due ${format(eventDate, 'MMM d')} (future: ${isFuture})`);
          }
          
          if (isInWeek && isFuture) {
            futureCanvasAssignments++;
          }
        });
        
        console.log('- Canvas assignments in current week:', canvasAssignmentsInWeek);
        console.log('- Future Canvas assignments in current week:', futureCanvasAssignments);
      }
      
      filteredCanvasEvents.forEach(event => {
        if (event.event_type !== 'assignment') return;
        
        const eventDate = new Date(event.start_time || event.end_time || event.due_date || '');
        console.log(`🔍 Checking Canvas assignment: "${event.title}" due ${format(eventDate, 'MMM d, yyyy')} - in current week: ${isWithinInterval(eventDate, { start: weekStart, end: weekEnd })}`);
        // Include ALL assignments due this week (both completed and pending)
        if (isWithinInterval(eventDate, { start: weekStart, end: weekEnd })) {
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

      // Debug completion status for current week
      if (weekStart.getTime() === currentWeekStart.getTime()) {
        console.log('🔢 WEEKLY PROGRESS COMPLETION DETAILS:');
        console.log('- Total assignments this week:', totalCount);
        console.log('- Completed assignments this week:', completedCount);
        console.log('- Progress percentage:', progressPercentage + '%');
        console.log('- Assignment completion details:');
        assignments.forEach((assignment, index) => {
          console.log(`  ${index + 1}. "${assignment.title}" - ${assignment.isCompleted ? 'COMPLETED' : '❌ INCOMPLETE'} (source: ${assignment.source})`);
        });
        
        // SPECIFICALLY LOG THE INCOMPLETE ONES
        const incompleteAssignments = assignments.filter(a => !a.isCompleted);
        console.log('❌ INCOMPLETE ASSIGNMENTS THIS WEEK:');
        incompleteAssignments.forEach((assignment, index) => {
          console.log(`  INCOMPLETE ${index + 1}: "${assignment.title}" (source: ${assignment.source}, due: ${assignment.dueDate.toDateString()})`);
        });
      }

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
    console.log('- Today is:', format(today, 'MMM d, yyyy'));
    console.log('- Current week:', format(currentWeek.weekStart, 'MMM d'), '-', format(currentWeek.weekEnd, 'MMM d'));
    console.log('- Current week progress:', `${currentWeek.completedCount}/${currentWeek.totalCount} (${currentWeek.progressPercentage}%)`);
    console.log('- Current week assignments:', currentWeek.assignments.map(a => `"${a.title}" (${a.isCompleted ? 'completed' : 'pending'})`));
    console.log('- Total userTasks:', userTasks.length);
    console.log('- Total userEvents:', userEvents.length);
    console.log('- Filtered Canvas Events:', filterRecentAssignments(userEvents).length);

    return {
      currentWeek,
      previousWeeks,
      upcomingWeeks
    } as WeeklyProgressData;
  }, [userTasks, userEvents]);
};