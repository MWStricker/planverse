import React from 'react';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { filterRecentAssignments } from '@/lib/assignment-filters';

interface Task {
  id: string;
  title: string;
  due_date?: string;
  completion_status?: string;
  course_name?: string;
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

interface DebugWeeklyProgressProps {
  userTasks: Task[];
  userEvents: Event[];
}

export const DebugWeeklyProgress: React.FC<DebugWeeklyProgressProps> = ({ userTasks, userEvents }) => {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Get all assignments due this week
  const assignments: Array<{
    id: string;
    title: string;
    dueDate: Date;
    isCompleted: boolean;
    source: 'canvas' | 'manual';
    courseCode?: string;
  }> = [];

  // Add manual tasks
  userTasks.forEach(task => {
    if (!task.due_date) return;
    
    const dueDate = new Date(task.due_date);
    if (isWithinInterval(dueDate, { start: currentWeekStart, end: currentWeekEnd })) {
      assignments.push({
        id: task.id,
        title: task.title,
        dueDate,
        isCompleted: task.completion_status === 'completed',
        source: 'manual',
        courseCode: task.course_name
      });
    }
  });

  // Add Canvas assignments
  const filteredCanvasEvents = filterRecentAssignments(userEvents);
  filteredCanvasEvents.forEach(event => {
    if (event.event_type !== 'assignment') return;
    
    const eventDate = new Date(event.start_time || event.end_time || event.due_date || '');
    if (isWithinInterval(eventDate, { start: currentWeekStart, end: currentWeekEnd })) {
      assignments.push({
        id: event.id,
        title: event.title,
        dueDate: eventDate,
        isCompleted: event.is_completed || false,
        source: 'canvas',
        courseCode: event.course_name
      });
    }
  });

  // Sort by due date
  assignments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const completedCount = assignments.filter(a => a.isCompleted).length;
  const totalCount = assignments.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const incompleteAssignments = assignments.filter(a => !a.isCompleted);

  return (
    <Card className="border-red-500 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-700">
          DEBUG: Weekly Progress Issue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-lg font-semibold">
          Progress: {completedCount}/{totalCount} ({progressPercentage}%)
        </div>
        
        <div>
          <h4 className="font-medium mb-2 text-red-700">
            INCOMPLETE Assignments ({incompleteAssignments.length}):
          </h4>
          {incompleteAssignments.length === 0 ? (
            <p className="text-green-600">All assignments are marked as complete!</p>
          ) : (
            <div className="space-y-2">
              {incompleteAssignments.map((assignment, index) => (
                <div key={assignment.id} className="p-2 border rounded bg-red-100">
                  <div className="flex items-center gap-2">
                    <Circle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">#{index + 1}: {assignment.title}</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-6">
                    Due: {format(assignment.dueDate, 'MMM d, h:mm a')} | 
                    Source: {assignment.source} | 
                    Course: {assignment.courseCode} |
                    ID: {assignment.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-medium mb-2 text-green-700">
            COMPLETED Assignments ({completedCount}):
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {assignments.filter(a => a.isCompleted).map((assignment, index) => (
              <div key={assignment.id} className="p-2 border rounded bg-green-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">#{index + 1}: {assignment.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};