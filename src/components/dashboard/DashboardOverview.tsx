import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Target, CheckCircle, TrendingUp, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isToday } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  is_completed?: boolean;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  completion_status: string;
}

interface Course {
  code: string;
  color: string;
  icon: any;
  totalAssignments: number;
  completedAssignments: number;
  upcomingAssignments: number;
}

interface DashboardOverviewProps {
  events: Event[];
  tasks: Task[];
  courses: Course[];
  dashboardStats: {
    totalCoursesActive: number;
    totalItemsToday: number;
    completedToday: number;
    progressPercentage: number;
  };
  onEventToggle: (eventId: string, isCompleted: boolean) => void;
}

export const DashboardOverview = memo(({ 
  events, 
  tasks, 
  courses,
  dashboardStats,
  onEventToggle 
}: DashboardOverviewProps) => {
  
  // Memoize today's events and tasks
  const todayItems = useMemo(() => {
    const todayEvents = events
      .filter(event => isToday(new Date(event.start_time)))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    
    const todayTasks = tasks
      .filter(task => task.due_date && isToday(new Date(task.due_date)))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
    return { todayEvents, todayTasks };
  }, [events, tasks]);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalCoursesActive}</div>
            <p className="text-xs text-muted-foreground">Courses tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalItemsToday}</div>
            <p className="text-xs text-muted-foreground">Items on your schedule</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.completedToday}</div>
            <p className="text-xs text-muted-foreground">Tasks finished today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.progressPercentage}%</div>
            <p className="text-xs text-muted-foreground">Completion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayItems.todayEvents.length === 0 && todayItems.todayTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No items scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {todayItems.todayEvents.map(event => (
                <div 
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={event.is_completed || false}
                    onCheckedChange={(checked) => onEventToggle(event.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${event.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                      {event.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                    </p>
                  </div>
                  <Badge variant="outline">{event.event_type}</Badge>
                </div>
              ))}
              
              {todayItems.todayTasks.map(task => (
                <div 
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={task.completion_status === 'completed'}
                    disabled
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${task.completion_status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due: {format(new Date(task.due_date), 'h:mm a')}
                    </p>
                  </div>
                  <Badge variant="outline">Task</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Course Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No courses to display</p>
          ) : (
            <div className="space-y-3">
              {courses.slice(0, 5).map(course => {
                const CourseIcon = course.icon;
                const completionRate = course.totalAssignments > 0 
                  ? Math.round((course.completedAssignments / course.totalAssignments) * 100)
                  : 0;
                
                return (
                  <div 
                    key={course.code}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <CourseIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{course.code}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{course.completedAssignments}/{course.totalAssignments} completed</span>
                        <span>•</span>
                        <span>{course.upcomingAssignments} upcoming</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{completionRate}%</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

DashboardOverview.displayName = 'DashboardOverview';
