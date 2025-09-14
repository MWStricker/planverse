import { useState, useEffect } from "react";
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, GraduationCap, FileText, ChevronDown, ChevronRight, Settings, Save, X, Palette } from "lucide-react";
import { getCourseIconById, courseIcons } from "@/data/courseIcons";

interface CoursesProps {}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

export const Courses = ({}: CoursesProps = {}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());
  const [storedColors, setStoredColors] = useState<Record<string, string>>({});
  const [courseIcons_State, setCourseIcons_State] = useState<Record<string, string>>({});
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [courseOrder, setCourseOrder] = useState<string[]>([]);
  const [isEditIconsMode, setIsEditIconsMode] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start dragging after 8px of movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleEventToggle = async (eventId: string, isCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_completed: isCompleted })
        .eq('id', eventId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error updating event completion:', error);
        toast({
          title: "Error",
          description: "Failed to update assignment status",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setCourses(prevCourses => 
        prevCourses.map(course => ({
          ...course,
          events: course.events.map(event => 
            event.id === eventId ? { ...event, is_completed: isCompleted } : event
          )
        }))
      );

      toast({
        title: isCompleted ? "Assignment completed" : "Assignment uncompleted",
        description: "Status updated successfully",
      });
    } catch (error) {
      console.error('Error toggling event completion:', error);
    }
  };

  const handleCourseIconChange = async (courseCode: string, iconId: string) => {
    if (!user?.id) return;

    console.log('handleCourseIconChange called:', { courseCode, iconId, userId: user.id });

    try {
      const newIcons = { ...courseIcons_State, [courseCode]: iconId };
      console.log('Saving new icons state:', newIcons);
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'course_icons',
          settings_data: newIcons
        }, {
          onConflict: 'user_id,settings_type'
        });

      if (error) {
        console.error('Error saving course icon:', error);
        toast({
          title: "Error",
          description: "Failed to save course icon",
          variant: "destructive",
        });
        return;
      }

      console.log('Course icon saved successfully to database');
      setCourseIcons_State(newIcons);
      
      // Update courses with new icon
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course.code === courseCode 
            ? { ...course, icon: getCourseIconById(iconId) }
            : course
        )
      );

      toast({
        title: "Success",
        description: `Icon updated for ${courseCode}`,
      });
    } catch (error) {
      console.error('Error updating course icon:', error);
    }
  };

  // Load all settings first, then fetch courses data
  useEffect(() => {
    if (!user?.id) return;

    const loadAllSettingsAndData = async () => {
      console.log('Loading all settings for user:', user.id);
      
      // Load all settings in parallel
      const [colorsResult, iconsResult, orderResult] = await Promise.all([
        supabase
          .from('course_colors')
          .select('course_code, canvas_color')
          .eq('user_id', user.id),
        supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_icons')
          .maybeSingle(),
        supabase
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_order')
          .maybeSingle()
      ]);

      // Process course colors
      if (colorsResult.data) {
        const colorMap: Record<string, string> = {};
        colorsResult.data.forEach(item => {
          colorMap[item.course_code] = item.canvas_color;
        });
        setStoredColors(colorMap);
      }

      // Process course icons
      if (iconsResult.data?.settings_data) {
        console.log('Loading saved course icons:', iconsResult.data.settings_data);
        setCourseIcons_State(iconsResult.data.settings_data as Record<string, string>);
      } else {
        console.log('No saved course icons found');
      }

      // Process course order
      let savedOrder: string[] | undefined;
      if (orderResult.data?.settings_data && typeof orderResult.data.settings_data === 'object' && 'order' in orderResult.data.settings_data) {
        savedOrder = (orderResult.data.settings_data as { order: string[] }).order;
        console.log('Found saved course order:', savedOrder);
        setCourseOrder(savedOrder);
      } else {
        console.log('No saved course order found');
      }

      // Now fetch courses data with all settings loaded
      console.log('All settings loaded, now fetching courses with icons state:', iconsResult.data?.settings_data);
      await fetchCoursesData(savedOrder);
    };

    loadAllSettingsAndData();
  }, [user?.id]);

  // Main data fetching function - now accepts optional saved order
  const fetchCoursesData = async (savedOrder?: string[]) => {
    if (!user?.id) return;
    
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

      // Apply saved course order if available
      const orderToUse = savedOrder || courseOrder;
      console.log('Processing courses with saved order:', orderToUse);
      console.log('Found courses:', processedCourses.map(c => c.code));
      
      let orderedCourses = processedCourses;
      if (orderToUse && orderToUse.length > 0) {
        console.log('Applying saved course order');
        orderedCourses = processedCourses.sort((a, b) => {
          const aIndex = orderToUse.indexOf(a.code);
          const bIndex = orderToUse.indexOf(b.code);
          
          // If both courses are in the saved order, use that order
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          // If only one is in the saved order, prioritize it
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          // If neither is in the saved order, sort alphabetically
          return a.code.localeCompare(b.code);
        });
      } else {
        console.log('No saved order, sorting alphabetically');
        orderedCourses = processedCourses.sort((a, b) => a.code.localeCompare(b.code));
      }

      console.log('Final ordered courses:', orderedCourses.map(c => c.code));
      setCourses(orderedCourses);
      
      // Update course order state if not set or if we have a saved order
      const currentCourseList = orderedCourses.map(course => course.code);
      if (savedOrder) {
        console.log('Setting course order from saved data');
        setCourseOrder(savedOrder);
      } else if (courseOrder.length === 0) {
        console.log('Setting initial course order');
        setCourseOrder(currentCourseList);
      }
      
      // Initialize all courses as collapsed
      setCollapsedCourses(new Set(orderedCourses.map(course => course.code)));
    } catch (error) {
      console.error('Error fetching courses data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = courses.findIndex(course => course.code === active.id);
      const newIndex = courses.findIndex(course => course.code === over?.id);

      console.log('Drag end - moving course from index', oldIndex, 'to index', newIndex);
      console.log('Current course order before move:', courses.map(c => c.code));

      if (oldIndex !== -1 && newIndex !== -1) {
        // Use setTimeout to defer state updates and prevent flash
        setTimeout(() => {
          const newCourses = arrayMove(courses, oldIndex, newIndex);
          const newOrder = newCourses.map(course => course.code);
          
          console.log('New course order after move:', newOrder);
          
          setCourses(newCourses);
          setCourseOrder(newOrder);
          
          // Add a subtle success feedback
          toast({
            title: "Course reordered",
            description: "Don't forget to save your changes!",
            duration: 2000,
          });
        }, 0);
      }
    }
  };

  const saveCourseOrder = async () => {
    if (!user?.id) return;

    console.log('Saving course order:', courseOrder);

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'course_order',
          settings_data: { order: courseOrder }
        }, {
          onConflict: 'user_id,settings_type'
        });

      if (error) {
        console.error('Error saving course order:', error);
        toast({
          title: "Error",
          description: "Failed to save course order",
          variant: "destructive",
        });
        return;
      }

      console.log('Course order saved successfully');
      setIsReorderMode(false);
      toast({
        title: "Success",
        description: "Course order saved successfully",
      });
    } catch (error) {
      console.error('Error saving course order:', error);
      toast({
        title: "Error", 
        description: "Failed to save course order",
        variant: "destructive",
      });
    }
  };

  const cancelReorder = () => {
    setIsReorderMode(false);
    // Reset to original order by refetching
    if (user?.id) {
      fetchCoursesData();
    }
  };

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

  // Use the exact same color logic as Calendar component
  const getCourseColor = (title: string, forCanvas = false, courseCode?: string) => {
    if (!forCanvas) return 'bg-muted/50 border-muted';
    
    const extractedCourseCode = courseCode || extractCourseCode(title, true);
    
    // First, try to use stored Canvas color
    if (storedColors && extractedCourseCode && storedColors[extractedCourseCode]) {
      const color = storedColors[extractedCourseCode];
      return `bg-[${color}]/20 border-[${color}]/30 text-[${color}] dark:bg-[${color}]/10 dark:border-[${color}]/40 dark:text-[${color}]`;
    }
    
    // Fallback color mapping based on course type - same as Calendar
    const colorMappings: Record<string, string> = {
      'HES': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      'HES-145': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      'PSY': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      'PSY-100': 'bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      'LIFE': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'LIFE-102': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'LIFE-102-L': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'MU': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'MU-100': 'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
      'MATH': 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
      'MATH-118': 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    };
    
    // Direct match first
    if (extractedCourseCode && colorMappings[extractedCourseCode]) {
      return colorMappings[extractedCourseCode];
    }
    
    // Try base code match (e.g., PSY from PSY-100)
    if (extractedCourseCode) {
      const baseCode = extractedCourseCode.split('-')[0];
      if (colorMappings[baseCode]) {
        return colorMappings[baseCode];
      }
    }
    
    // Generate consistent color for unknown courses using hash
    const courseColors = [
      'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
      'bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
      'bg-teal-100 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200',
      'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
      'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
      'bg-pink-100 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-800 dark:text-pink-200',
    ];
    
    // Simple hash function
    let hash = 0;
    const textToHash = extractedCourseCode || title;
    for (let i = 0; i < textToHash.length; i++) {
      hash = ((hash << 5) - hash + textToHash.charCodeAt(i)) & 0xffffffff;
    }
    
    // Use hash to select a color from the array
    const colorIndex = Math.abs(hash) % courseColors.length;
    return courseColors[colorIndex];
  };

  const getCourseIcon = (courseCode: string) => {
    const customIconId = courseIcons_State[courseCode];
    console.log('getCourseIcon called:', { courseCode, customIconId, allIconsState: courseIcons_State });
    if (customIconId) {
      console.log('Using custom icon:', customIconId);
      return getCourseIconById(customIconId);
    }
    
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
    if (item.completion_status === 'completed' || item.is_completed) return 'completed';
    
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
          {!isReorderMode ? (
            <>
              <Badge variant="outline" className="bg-background">
                {courses.reduce((sum, course) => sum + course.totalAssignments, 0)} Total Assignments
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditIconsMode(!isEditIconsMode)}
                className="flex items-center gap-2"
              >
                <Palette className="h-4 w-4" />
                {isEditIconsMode ? 'Done Editing' : 'Edit Icons'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReorderMode(true)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Reorder Courses
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelReorder}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveCourseOrder}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Order
              </Button>
            </div>
          )}
        </div>
      </div>

      {isReorderMode && courses.length > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border-2 border-dashed border-primary/30 animate-fade-in">
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-foreground font-medium">
              Click and drag any course card to reorder them
            </p>
          </div>
        </div>
      )}


      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll={false}
      >
        <SortableContext
          items={courses.map(course => course.code)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-6">
            {courses.map((course) => (
              <SortableCourseCard
                key={course.code}
                course={course}
                isReorderMode={isReorderMode}
                isEditIconsMode={isEditIconsMode}
                isCollapsed={collapsedCourses.has(course.code)}
                onToggle={() => toggleCourse(course.code)}
                onEventToggle={handleEventToggle}
                onIconChange={handleCourseIconChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

// Sortable Course Card Component
const SortableCourseCard = ({ 
  course, 
  isReorderMode, 
  isEditIconsMode,
  isCollapsed, 
  onToggle, 
  onEventToggle,
  onIconChange
}: {
  course: Course;
  isReorderMode: boolean;
  isEditIconsMode: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onEventToggle: (eventId: string, isCompleted: boolean) => void;
  onIconChange: (courseCode: string, iconId: string) => void;
}) => {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ 
    id: course.code,
    disabled: !isReorderMode 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : undefined,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const CourseIcon = course.icon;
  const allAssignments = [...course.events, ...course.tasks];
  
  // Separate completed and active assignments
  const completedAssignments = allAssignments.filter(assignment => 
    assignment.completion_status === 'completed' || assignment.is_completed
  ).sort((a, b) => {
    const dateA = new Date(a.due_date || a.end_time || a.start_time);
    const dateB = new Date(b.due_date || b.end_time || b.start_time);
    return dateA.getTime() - dateB.getTime();
  });
  
  const activeAssignments = allAssignments.filter(assignment => 
    assignment.completion_status !== 'completed' && !assignment.is_completed
  ).sort((a, b) => {
    const dateA = new Date(a.due_date || a.end_time || a.start_time);
    const dateB = new Date(b.due_date || b.end_time || b.start_time);
    return dateA.getTime() - dateB.getTime();
  });

  const visibleAssignments = [...activeAssignments, ...completedAssignments];

  const getAssignmentStatus = (item: any) => {
    if (item.completion_status === 'completed' || item.is_completed) return 'completed';
    
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

  const formatAssignmentDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isPast(date)) return `Past due - ${format(date, 'MMM d')}`;
    return format(date, 'MMM d, yyyy');
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`${course.color} border-2 transition-opacity duration-150 ${
        isDragging ? 'shadow-lg' : ''
      } ${
        isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
    >
      <Collapsible open={!isCollapsed} onOpenChange={isReorderMode ? undefined : onToggle}>
        <CollapsibleTrigger asChild disabled={isReorderMode}>
          <CardHeader className={`transition-colors duration-200 ${
            isReorderMode ? 'cursor-grab active:cursor-grabbing select-none pointer-events-none' : 
            'cursor-pointer hover:bg-background/10 select-none'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isEditIconsMode ? (
                  <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowIconPicker(true);
                        }}
                      >
                        <CourseIcon className="h-6 w-6" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="start">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Choose an icon for {course.code}</h4>
                        <div className="grid grid-cols-8 gap-2">
                          {courseIcons.map((icon) => (
                        <Button
                          key={icon.id}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onIconChange(course.code, icon.id);
                            setShowIconPicker(false);
                          }}
                          title={icon.name}
                        >
                          <icon.icon className="h-4 w-4" />
                        </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <CourseIcon className="h-6 w-6" />
                )}
                <div>
                  <CardTitle className="text-xl">{course.code}</CardTitle>
                  <p className="text-sm opacity-80">
                    {activeAssignments.length} active • {completedAssignments.length} completed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isReorderMode && activeAssignments.length > 0 && (
                  <Badge variant="outline" className="bg-background/50">
                    {activeAssignments.length} upcoming
                  </Badge>
                )}
                {!isReorderMode && (
                  isCollapsed ? (
                    <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  )
                )}
                {isReorderMode && (
                  <div className="text-xs text-muted-foreground font-medium px-2 py-1 bg-background/30 rounded">
                    Drag to reorder
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        {!isReorderMode && (
          <CollapsibleContent className="overflow-hidden transition-all duration-300 ease-in-out">
            <CardContent className="space-y-4">
              {visibleAssignments.length > 0 ? (
                <div className="space-y-3">
                  {visibleAssignments.map((assignment, index) => {
                    const status = getAssignmentStatus(assignment);
                    const dueDate = assignment.due_date || assignment.end_time;
                    const isCompleted = status === 'completed';
                    
                    return (
                      <div key={assignment.id || index} className={`flex items-center gap-3 p-3 bg-background/50 rounded-lg border transition-colors duration-200 hover:bg-background/70 ${isCompleted ? 'opacity-75' : ''}`}>
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={(checked) => {
                            // Only handle events (Canvas assignments), not manual tasks
                            if (assignment.source_provider === 'canvas' && assignment.id) {
                              onEventToggle(assignment.id, !!checked);
                            }
                          }}
                          disabled={assignment.source_provider !== 'canvas'}
                          className="flex-shrink-0"
                        />
                        <div className="flex items-center justify-between flex-1">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium text-sm truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                {assignment.title.replace(/\[.*?\]/g, '').trim()}
                              </p>
                              {dueDate && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span className={`text-xs ${isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
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
        )}
      </Collapsible>
    </Card>
  );
};
