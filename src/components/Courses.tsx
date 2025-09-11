import { useState, useEffect } from "react";
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, GraduationCap, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday, isTomorrow } from "date-fns";

interface Course {
  code: string;
  color: string;
  icon: any;
  events: any[];
  tasks: any[];
  totalAssignments: number;
  completedAssignments: number;
  upcomingAssignments: number;
}

export const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const fetchCoursesData = async () => {
      setLoading(true);
      
      try {
        const [eventsResult, tasksResult] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('source_provider', 'canvas'),
          supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('source_provider', 'canvas')
        ]);

        const events = eventsResult.data || [];
        const tasks = tasksResult.data || [];

        // Process courses similar to Calendar component
        const coursesMap = new Map();

        events.forEach(event => {
          const courseCode = extractCourseCode(event.title, true);
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
              coursesMap.set(courseCode, {
                code: courseCode,
                color: getCourseColor(event.title, true),
                icon: getCourseIcon(event.title, true),
                events: [],
                tasks: []
              });
            }
            coursesMap.get(courseCode).events.push(event);
          }
        });

        tasks.forEach(task => {
          const courseCode = task.course_name || extractCourseCode(task.title, true);
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
              const pseudoTitle = `[2025FA-${courseCode}]`;
              coursesMap.set(courseCode, {
                code: courseCode,
                color: getCourseColor(pseudoTitle, true),
                icon: getCourseIcon(pseudoTitle, true),
                events: [],
                tasks: []
              });
            }
            coursesMap.get(courseCode).tasks.push(task);
          }
        });

        // Calculate statistics for each course
        const processedCourses = Array.from(coursesMap.values()).map(course => {
          const allAssignments = [...course.events, ...course.tasks];
          const completedTasks = course.tasks.filter(task => task.completion_status === 'completed').length;
          const upcomingAssignments = allAssignments.filter(item => {
            const dueDate = item.due_date || item.end_time;
            return dueDate && !isPast(new Date(dueDate));
          }).length;

          return {
            ...course,
            totalAssignments: allAssignments.length,
            completedAssignments: completedTasks,
            upcomingAssignments
          };
        });

        setCourses(processedCourses.sort((a, b) => a.code.localeCompare(b.code)));
      } catch (error) {
        console.error('Error fetching courses data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoursesData();
  }, [user?.id]);

  // Helper functions
  const extractCourseCode = (title: string, forCanvas = false) => {
    if (!forCanvas) return null;
    
    const patterns = [
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}\d{3,4}[A-Z]?)\]/,
      /\[([A-Z]{2,4}\d{3,4}[A-Z]?)-(\d{4}[A-Z]{2})\]/,
      /([A-Z]{2,4}\s?\d{3,4}[A-Z]?)/,
      /\b([A-Z]{2,4}\d{3,4}[A-Z]?)\b/
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[2] || match[1];
      }
    }
    return null;
  };

  const getCourseColor = (title: string, forCanvas = false) => {
    if (!forCanvas) return 'bg-muted/50 border-muted';
    
    const colors = [
      'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 text-blue-900',
      'bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-900',
      'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 text-purple-900',
      'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 text-orange-900',
      'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-900',
      'bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200 text-pink-900',
      'bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-900',
      'bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200 text-teal-900'
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash + title.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCourseIcon = (title: string, forCanvas = false) => {
    if (!forCanvas) return BookOpen;
    
    const code = extractCourseCode(title, true)?.toLowerCase() || '';
    
    if (code.includes('math') || code.includes('calc') || code.includes('algebra')) return GraduationCap;
    if (code.includes('psy') || code.includes('psychology')) return BookOpen;
    if (code.includes('life') || code.includes('bio') || code.includes('science')) return FileText;
    if (code.includes('hes') || code.includes('health')) return AlertCircle;
    if (code.includes('mu') || code.includes('music')) return BookOpen;
    
    return BookOpen;
  };

  const formatAssignmentDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isPast(date)) return `Past due - ${format(date, 'MMM d')}`;
    return format(date, 'MMM d, yyyy');
  };

  const getAssignmentStatus = (item: any) => {
    if (item.completion_status === 'completed') return 'completed';
    
    const dueDate = item.due_date || item.end_time;
    if (dueDate && isPast(new Date(dueDate))) return 'overdue';
    if (dueDate && isToday(new Date(dueDate))) return 'due-today';
    if (dueDate && isTomorrow(new Date(dueDate))) return 'due-tomorrow';
    return 'upcoming';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      case 'due-today':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800">Due Today</Badge>;
      case 'due-tomorrow':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Due Tomorrow</Badge>;
      default:
        return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BookOpen className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-2">No Courses Found</h2>
          <p className="text-muted-foreground">
            Connect your Canvas account to see your courses and assignments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Courses</h1>
          <p className="text-muted-foreground mt-1">
            {courses.length} courses synced from Canvas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-background">
            {courses.reduce((sum, course) => sum + course.totalAssignments, 0)} Total Assignments
          </Badge>
        </div>
      </div>

      <div className="grid gap-6">
        {courses.map((course) => {
          const CourseIcon = course.icon;
          const allAssignments = [...course.events, ...course.tasks].sort((a, b) => {
            const dateA = new Date(a.due_date || a.end_time || a.start_time);
            const dateB = new Date(b.due_date || b.end_time || b.start_time);
            return dateA.getTime() - dateB.getTime();
          });

          return (
            <Card key={course.code} className={`${course.color} border-2`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CourseIcon className="h-6 w-6" />
                    <div>
                      <CardTitle className="text-xl">{course.code}</CardTitle>
                      <p className="text-sm opacity-80">
                        {course.totalAssignments} assignments • {course.completedAssignments} completed
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {course.upcomingAssignments > 0 && (
                      <Badge variant="outline" className="bg-background/50">
                        {course.upcomingAssignments} upcoming
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {allAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {allAssignments.map((assignment, index) => {
                      const status = getAssignmentStatus(assignment);
                      const dueDate = assignment.due_date || assignment.end_time;
                      
                      return (
                        <div key={assignment.id || index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {assignment.title.replace(/\[.*?\]/g, '').trim()}
                              </p>
                              {dueDate && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {formatAssignmentDate(dueDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No assignments found for this course</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};