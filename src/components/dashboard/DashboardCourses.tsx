import { memo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, isPast } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_completed?: boolean;
  event_type: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  completion_status: string;
  priority_score: number;
}

interface Course {
  code: string;
  color: string;
  icon: any;
  events: Event[];
  tasks: Task[];
  totalAssignments: number;
  completedAssignments: number;
  upcomingAssignments: number;
}

interface DashboardCoursesProps {
  courses: Course[];
  collapsedCourses: Set<string>;
  onToggleCourse: (courseCode: string) => void;
  onEventClick: (event: Event) => void;
  onTaskClick: (task: Task) => void;
  onEventToggle: (eventId: string, isCompleted: boolean) => void;
}

export const DashboardCourses = memo(({ 
  courses, 
  collapsedCourses,
  onToggleCourse,
  onEventClick,
  onTaskClick,
  onEventToggle 
}: DashboardCoursesProps) => {
  
  const renderAssignmentItem = useCallback((item: Event | Task, type: 'event' | 'task') => {
    const isEvent = type === 'event';
    const event = isEvent ? (item as Event) : null;
    const task = !isEvent ? (item as Task) : null;
    
    const dueDate = isEvent ? event!.end_time : task!.due_date;
    const isCompleted = isEvent ? event!.is_completed : task!.completion_status === 'completed';
    const isDuePast = isPast(new Date(dueDate));
    
    return (
      <div 
        key={item.id}
        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => isEvent ? onEventClick(event!) : onTaskClick(task!)}
      >
        {isEvent && (
          <Checkbox
            checked={event!.is_completed || false}
            onCheckedChange={(checked) => {
              onEventToggle(event!.id, checked as boolean);
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {item.title}
          </p>
          <p className="text-sm text-muted-foreground">
            Due: {format(new Date(dueDate), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={isCompleted ? 'outline' : isDuePast ? 'destructive' : 'default'}>
            {isCompleted ? 'Completed' : isDuePast ? 'Overdue' : isEvent ? event!.event_type : 'Task'}
          </Badge>
          {!isEvent && task!.priority_score && (
            <Badge variant="secondary" className="text-xs">
              Priority: {task!.priority_score}
            </Badge>
          )}
        </div>
      </div>
    );
  }, [onEventClick, onTaskClick, onEventToggle]);

  return (
    <div className="space-y-4">
      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No courses to display. Import from Canvas or add manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        courses.map(course => {
          const CourseIcon = course.icon;
          const isCollapsed = collapsedCourses.has(course.code);
          const allAssignments = [...course.events, ...course.tasks].sort((a, b) => {
            const dateA = new Date('end_time' in a ? a.end_time : a.due_date);
            const dateB = new Date('end_time' in b ? b.end_time : b.due_date);
            return dateA.getTime() - dateB.getTime();
          });

          return (
            <Collapsible
              key={course.code}
              open={!isCollapsed}
              onOpenChange={() => onToggleCourse(course.code)}
            >
              <Card>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                        <CourseIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{course.code}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {course.completedAssignments}/{course.totalAssignments} completed
                        </Badge>
                        <Badge variant="secondary">
                          {course.upcomingAssignments} upcoming
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {allAssignments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No assignments for this course
                      </p>
                    ) : (
                      allAssignments.map(item => 
                        renderAssignmentItem(
                          item,
                          'end_time' in item ? 'event' : 'task'
                        )
                      )
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })
      )}
    </div>
  );
});

DashboardCourses.displayName = 'DashboardCourses';
