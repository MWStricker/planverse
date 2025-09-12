import { useState, useEffect } from "react";
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, GraduationCap, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  const { user } = useAuth();

  const toggleCourse = (courseCode: string) => {
    setCollapsedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseCode)) {
        newSet.delete(courseCode);
      } else {
        newSet.add(courseCode);
      }
      return newSet;
    });
  };

  // Fetch stored course colors
  useEffect(() => {
    if (!user?.id) return;

    const fetchStoredColors = async () => {
      const { data: colors } = await supabase
        .from('course_colors')
        .select('course_code, canvas_color')
        .eq('user_id', user.id);

      if (colors) {
        const colorMap: Record<string, string> = {};
        colors.forEach(item => {
          colorMap[item.course_code] = item.canvas_color;
        });
        setStoredColors(colorMap);
      }
    };

    fetchStoredColors();
  }, [user?.id]);

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

        console.log('Canvas events found:', events.length);
        console.log('Canvas tasks found:', tasks.length);
        console.log('First 5 event titles:', events.slice(0, 5).map(e => e.title));

        // Process courses from Canvas events
        const coursesMap = new Map();

        // Process events first
        events.forEach((event, index) => {
          console.log(`Event ${index + 1}:`, event.title);
          const courseCode = extractCourseCode(event.title, true);
          console.log('Processing event:', event.title, 'extracted course:', courseCode);
          
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
            coursesMap.set(courseCode, {
              code: courseCode,
              color: getCourseColor(event.title, true, courseCode),
              icon: getCourseIcon(courseCode),
              events: [],
              tasks: []
            });
            }
            coursesMap.get(courseCode).events.push(event);
          }
        });

        // Process tasks
        tasks.forEach(task => {
          const courseCode = task.course_name || extractCourseCode(task.title, true);
          if (courseCode) {
            if (!coursesMap.has(courseCode)) {
              const pseudoTitle = `[2025FA-${courseCode}]`;
            coursesMap.set(courseCode, {
              code: courseCode,
              color: getCourseColor(pseudoTitle, true, courseCode),
              icon: getCourseIcon(courseCode),
              events: [],
              tasks: []
            });
            }
            coursesMap.get(courseCode).tasks.push(task);
          }
        });

        console.log('Courses found:', Array.from(coursesMap.keys()));

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

        const sortedCourses = processedCourses.sort((a, b) => a.code.localeCompare(b.code));
        setCourses(sortedCourses);
        
        // Initialize all courses as collapsed
        setCollapsedCourses(new Set(sortedCourses.map(course => course.code)));
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
    
    // Enhanced patterns for Canvas course extraction
    const patterns = [
      // [2025FA-PSY-100-007] or [2025FA-LIFE-102-003] format
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)\]/i,
      // [PSY-100-007-2025FA] format
      /\[([A-Z]{2,4}-?\d{3,4}[A-Z]?(?:-[A-Z]?\d*)?)-(\d{4}[A-Z]{2})\]/i,
      // Simple course codes like PSY-100, MATH-118, LIFE-102, etc.
      /\b([A-Z]{2,4}-?\d{3,4}[A-Z]?)\b/i,
      // Lab courses like LIFE-102-L16
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}-?L\d*)\]/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        // Return the course code, cleaning up any extra formatting
        let courseCode = match[2] || match[1];
        // Remove semester info and normalize format
        courseCode = courseCode.replace(/\d{4}[A-Z]{2}/, '').replace(/^-|-$/, '');
        
        // Handle lab courses - keep the L designation but remove section numbers
        if (courseCode.includes('-L')) {
          courseCode = courseCode.replace(/-L\d+$/, '-L');
        }
        // If it's a regular course with section number, keep just the base course
        else if (courseCode.match(/^[A-Z]{2,4}-?\d{3,4}-\d{3}$/i)) {
          courseCode = courseCode.replace(/-\d{3}$/, '');
        }
        
        console.log('Extracted course code:', courseCode, 'from title:', title);
        return courseCode.toUpperCase();
      }
    }
    
    console.log('No course code found in:', title);
    return null;
  };

  const getCourseColor = (title: string, forCanvas = false, courseCode?: string) => {
    if (!forCanvas) return 'bg-muted/50 border-muted';
    
    // First, try to use stored Canvas color
    if (courseCode && storedColors[courseCode]) {
      const color = storedColors[courseCode];
      return `border-2 text-white` + ` ` + `bg-[${color}] border-[${color}]`;
    }
    
    // Subject-based color mapping as fallback
    const subjectColors: Record<string, string> = {
      'HES': 'bg-red-600 text-white border-red-600',         // Health - Red
      'HES-145': 'bg-red-600 text-white border-red-600',     // Health - Red
      'PSY': 'bg-red-600 text-white border-red-600',         // Psychology - Red  
      'PSY-100': 'bg-red-600 text-white border-red-600',     // Psychology - Red  
      'LIFE': 'bg-green-600 text-white border-green-600',    // Life Sciences - Green
      'LIFE-102': 'bg-green-600 text-white border-green-600', // Life Sciences - Green
      'LIFE-102-L': 'bg-green-600 text-white border-green-600', // Life Sciences Lab - Green
      'MU': 'bg-green-600 text-white border-green-600',      // Music - Green
      'MU-100': 'bg-green-600 text-white border-green-600',  // Music - Green
      'MATH': 'bg-amber-700 text-white border-amber-700',    // Mathematics - Brown
      'MATH-118': 'bg-amber-700 text-white border-amber-700', // Mathematics - Brown
    };
    
    if (courseCode) {
      // Try exact match first
      if (subjectColors[courseCode]) {
        return subjectColors[courseCode];
      }
      
      // Try base code match
      const baseCode = courseCode.split('-')[0];
      if (subjectColors[baseCode]) {
        return subjectColors[baseCode];
      }
    }
    
    // Final fallback to CSU green colors
    const colors = [
      'bg-emerald-700 text-white border-emerald-700',
      'bg-green-700 text-white border-green-700',
      'bg-teal-700 text-white border-teal-700',
      'bg-emerald-600 text-white border-emerald-600',
      'bg-green-600 text-white border-green-600',
      'bg-teal-600 text-white border-teal-600',
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash + title.charCodeAt(i)) & 0xffffffff;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCourseIcon = (courseCode: string) => {
    const code = courseCode.toLowerCase();
    
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

          const isCollapsed = collapsedCourses.has(course.code);
          const filteredAssignments = allAssignments.filter(assignment => getAssignmentStatus(assignment) !== 'overdue');

          return (
            <Card key={course.code} className={`${course.color} border-2 transition-all duration-300 ease-in-out`}>
              <Collapsible open={!isCollapsed} onOpenChange={() => toggleCourse(course.code)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-background/10 transition-colors duration-200 select-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CourseIcon className="h-6 w-6" />
                        <div>
                          <CardTitle className="text-xl">{course.code}</CardTitle>
                          <p className="text-sm opacity-80">
                            {filteredAssignments.length} assignments • {course.completedAssignments} completed
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {course.upcomingAssignments > 0 && (
                          <Badge variant="outline" className="bg-background/50">
                            {course.upcomingAssignments} upcoming
                          </Badge>
                        )}
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                        ) : (
                          <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="overflow-hidden transition-all duration-300 ease-in-out">
                  <CardContent className="space-y-4">
                 {allAssignments.length > 0 ? (
                   <div className="space-y-3">
                     {allAssignments
                       .filter(assignment => getAssignmentStatus(assignment) !== 'overdue')
                       .map((assignment, index) => {
                         const status = getAssignmentStatus(assignment);
                         const dueDate = assignment.due_date || assignment.end_time;
                         
                         return (
                           <div key={assignment.id || index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg border transition-colors duration-200 hover:bg-background/70">
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
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
};