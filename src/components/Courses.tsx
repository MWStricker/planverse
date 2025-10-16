import { useState, useEffect } from "react";
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, GraduationCap, FileText, ChevronDown, ChevronRight, Settings, Save, X, Palette } from "lucide-react";
import { getCourseIconById, courseIcons } from "@/data/courseIcons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  semester: string;
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
  const [activeTab, setActiveTab] = useState("courses");
  const [selectedCourseForColor, setSelectedCourseForColor] = useState<string | null>(null);
  const [previousSelectedCourse, setPreviousSelectedCourse] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Auto-save colors when clicking away from color picker
  useEffect(() => {
    if (previousSelectedCourse && previousSelectedCourse !== selectedCourseForColor) {
      forceSaveAllCourseColors();
    }
    setPreviousSelectedCourse(selectedCourseForColor);
  }, [selectedCourseForColor]);

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
      
      // Notify other components to refresh their data
      window.dispatchEvent(new CustomEvent('dataRefresh'));
      window.dispatchEvent(new CustomEvent('taskCompleted', { 
        detail: { eventId, isCompleted } 
      }));
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

  const handleCourseColorChange = async (courseCode: string, color: string) => {
    if (!user?.id) return;

    try {
      console.log('Updating course color:', { courseCode, color });
      
      // Get current colors
      const { data: currentData } = await supabase
        .from('user_settings')
        .select('settings_data')
        .eq('user_id', user.id)
        .eq('settings_type', 'course_colors')
        .maybeSingle();

      const colors = (currentData?.settings_data as Record<string, string>) || {};
      colors[courseCode] = color;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'course_colors',
          settings_data: colors
        }, {
          onConflict: 'user_id,settings_type'
        });

      if (error) {
        console.error('Error saving course color:', error);
        toast({
          title: "Error",
          description: "Failed to save course color",
          variant: "destructive",
        });
        return;
      }

      const newColors = { ...storedColors, [courseCode]: color };
      setStoredColors(newColors);
      
      // Update courses with new color - use inline styles instead of Tailwind classes
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course.code === courseCode 
            ? { ...course, color: color }
            : course
        )
      );

      // Close the color selection modal after saving
      setSelectedCourseForColor(null);

      toast({
        title: "Success",
        description: `Color updated for ${courseCode}`,
      });
    } catch (error) {
      console.error('Error updating course color:', error);
    }
  };

  const forceSaveAllCourseColors = async () => {
    if (!user?.id || courses.length === 0) return;

    try {
      console.log('Force saving all course colors:', storedColors);
      
      // Save all course colors to database
      const colorMap = courses.reduce((acc, course) => {
        acc[course.code] = typeof course.color === 'string' ? course.color : '#6b7280';
        return acc;
      }, {} as Record<string, string>);

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          settings_type: 'course_colors',
          settings_data: colorMap
        }, {
          onConflict: 'user_id,settings_type'
        });

      if (error) {
        console.error('Error force saving course colors:', error);
        toast({
          title: "Error",
          description: "Failed to save course colors",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "All course colors saved successfully!",
      });
    } catch (error) {
      console.error('Error force saving course colors:', error);
      toast({
        title: "Error", 
        description: "Failed to save course colors",
        variant: "destructive",
      });
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
          .from('user_settings')
          .select('settings_data')
          .eq('user_id', user.id)
          .eq('settings_type', 'course_colors')
          .maybeSingle(),
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
      let colorMap: Record<string, string> = {};
      if (colorsResult.data?.settings_data) {
        colorMap = colorsResult.data.settings_data as Record<string, string>;
        console.log('Loading saved course colors:', colorMap);
        setStoredColors(colorMap);
      } else {
        console.log('No saved course colors found');
      }

      // Process course icons - get the actual data, not set state yet
      let loadedIcons: Record<string, string> = {};
      if (iconsResult.data?.settings_data) {
        console.log('Loading saved course icons:', iconsResult.data.settings_data);
        loadedIcons = iconsResult.data.settings_data as Record<string, string>;
        setCourseIcons_State(loadedIcons);
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

      // Now fetch courses data with the loaded icons and colors passed directly
      console.log('All settings loaded, now fetching courses with loaded icons and colors:', loadedIcons, colorMap);
      await fetchCoursesDataWithIcons(savedOrder, loadedIcons, colorMap);
    };

    loadAllSettingsAndData();
  }, [user?.id]);

  // Modified function to accept icons and colors directly instead of relying on state
  const fetchCoursesDataWithIcons = async (savedOrder?: string[], loadedIcons: Record<string, string> = {}, loadedColors: Record<string, string> = {}) => {
    if (!user?.id) return;
    
    setLoading(true);
    
    // Local function to get course icon using loaded icons instead of state
    const getCourseIconWithLoadedIcons = (courseCode: string) => {
      const customIconId = loadedIcons[courseCode];
      console.log('getCourseIconWithLoadedIcons called:', { courseCode, customIconId, loadedIcons });
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
        const extracted = extractCourseCode(event.title, true);
        console.log('Processing event:', event.title, 'extracted:', extracted);
        
        if (!extracted) return;
        if (typeof extracted !== 'object') return;
        
        const code = 'code' in extracted ? (extracted.code as string) : '';
        const semester = 'semester' in extracted ? (extracted.semester as string) : '';
        if (!code || !semester) return;
        const fullKey = `${semester}-${code}`;
        
        if (!coursesMap.has(fullKey)) {
        coursesMap.set(fullKey, {
          code: code,
          semester: semester,
          color: loadedColors[code] || getCourseColor(event.title, true, code),
          icon: getCourseIconWithLoadedIcons(code),
          events: [],
          tasks: []
        });
        }
        coursesMap.get(fullKey).events.push(event);
      });

      // Process tasks
      tasks.forEach(task => {
        const extractedRaw = task.course_name || extractCourseCode(task.title, true);
        if (!extractedRaw) return;
        
        let code: string, semester: string;
        if (typeof extractedRaw === 'object') {
          code = 'code' in extractedRaw ? (extractedRaw.code as string) : '';
          semester = 'semester' in extractedRaw ? (extractedRaw.semester as string) : '';
          if (!code || !semester) return;
        } else if (typeof extractedRaw === 'string') {
          code = extractedRaw;
          semester = '2025FA'; // Default for tasks without semester
        } else {
          return; // Skip if we can't extract course info
        }
        
        const fullKey = `${semester}-${code}`;
        
        if (!coursesMap.has(fullKey)) {
          const pseudoTitle = `[${semester}-${code}]`;
        coursesMap.set(fullKey, {
          code: code,
          semester: semester,
          color: loadedColors[code] || getCourseColor(pseudoTitle, true, code),
          icon: getCourseIconWithLoadedIcons(code),
          events: [],
          tasks: []
        });
        }
        coursesMap.get(fullKey).tasks.push(task);
      });

      console.log('Courses found:', Array.from(coursesMap.keys()));
      
      // Filter to show only the most recent semester
      const allCourses = Array.from(coursesMap.values());
      const semesters = allCourses.map(c => c.semester).filter(s => s !== 'UNKNOWN');
      const mostRecentSemester = semesters.length > 0 
        ? semesters.sort((a, b) => b.localeCompare(a))[0]
        : '2025FA';
      
      console.log(`🎓 Most recent semester detected: ${mostRecentSemester}`);
      console.log(`📊 Filtering ${allCourses.length} courses to show only ${mostRecentSemester} courses`);
      
      const filteredCourses = allCourses.filter(course => course.semester === mostRecentSemester);

      // Calculate statistics for each course
      const processedCourses = filteredCourses.map(course => {
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
      
      console.log(`✅ Displaying ${processedCourses.length} courses from ${mostRecentSemester}:`, processedCourses.map(c => c.code));

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
      fetchCoursesDataWithIcons();
    }
  };

  // Helper functions
  const extractCourseCode = (title: string, forCanvas = false): string | { code: string; semester: string } | null => {
    if (!forCanvas) return null;
    
    // Enhanced patterns for Canvas course extraction
    const patterns = [
      // [2025FA-LIFE-102-003] or [2025FA-LIFE-102-L16]
      /\[(\d{4}[A-Z]{2})-([A-Z]{2,4}-?\d{3,4}(?:-?[A-Z]?\d*)?)\]/i,
      // [CHS1440C-25Fall 0021] or [COP2500C_CMB-25Fall]
      /\[([A-Z]{3}\d{4}[A-Z](?:_[A-Z]+)?)-(\d{2}[A-Z][a-z]+)\s*\d*\]/i,
      // Simple course codes without semester (fallback)
      /\b([A-Z]{2,4}-?\d{3,4}[A-Z]?)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        let courseCode = '';
        let semester = '';
        
        // Pattern 1: [2025FA-COURSE-XXX]
        if (match[1] && match[1].match(/^\d{4}[A-Z]{2}$/)) {
          semester = match[1];
          courseCode = match[2];
        }
        // Pattern 2: [COURSE-25Fall]
        else if (match[2] && match[2].match(/^\d{2}[A-Z][a-z]+$/)) {
          semester = match[2];
          courseCode = match[1];
        }
        // Pattern 3: No semester info
        else {
          courseCode = match[1];
          semester = 'UNKNOWN';
        }
        
        // Clean up course code
        courseCode = courseCode.replace(/\d{4}[A-Z]{2}/, '').replace(/^-|-$/, '');
        
        // Normalize semester format (25Fall -> 2025FA, etc.)
        if (semester.match(/^\d{2}[A-Z][a-z]+$/)) {
          const yearSuffix = semester.slice(0, 2);
          const term = semester.slice(2);
          const termCode = term.toLowerCase().includes('fall') ? 'FA' : 
                          term.toLowerCase().includes('spring') ? 'SP' : 
                          term.toLowerCase().includes('summer') ? 'SU' : term.slice(0, 2).toUpperCase();
          semester = `20${yearSuffix}${termCode}`;
        }
        
        const finalCode = courseCode.toUpperCase();
        console.log(`📚 Extracted: ${finalCode} (${semester}) from: ${title}`);
        return { code: finalCode, semester };
      }
    }
    
    console.log('❌ No course code found in:', title);
    return null;
  };

  const handleResetCourseOrder = async () => {
    if (!user) return;
    
    try {
      // Clear localStorage
      localStorage.removeItem('courseOrder');
      localStorage.removeItem(`customCourseColors-${user.id}`);
      localStorage.removeItem(`customCourseIcons-${user.id}`);
      
      console.log('🔄 Cleared course localStorage - refreshing...');
      
      // Reset state
      setCourseOrder([]);
      setStoredColors({});
      setCourseIcons_State({});
      
      // Reload courses
      await fetchCoursesDataWithIcons();
      
      toast({
        title: "Course Order Reset",
        description: "All course settings have been cleared. The page will reload.",
      });
      
      // Force full page refresh after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error resetting course order:', error);
      toast({
        title: "Reset Failed",
        description: "Could not reset course order.",
        variant: "destructive",
      });
    }
  };

  // Use the exact same color logic as Calendar component
  const getCourseColor = (title: string, forCanvas = false, courseCode?: string) => {
    if (!forCanvas) return '#6b7280'; // Default gray color for non-canvas courses
    
    const extractedData = courseCode || extractCourseCode(title, true);
    const extractedCourseCode = typeof extractedData === 'object' && extractedData !== null 
      ? extractedData.code 
      : (typeof extractedData === 'string' ? extractedData : null);
    
    // First, try to use stored Canvas color (return the hex value directly)
    if (storedColors && extractedCourseCode && typeof extractedCourseCode === 'string' && storedColors[extractedCourseCode]) {
      return storedColors[extractedCourseCode];
    }
    
    // Fallback color mapping based on course type - return hex colors
    const colorMappings: Record<string, string> = {
      'HES': '#ef4444',      // red-500
      'HES-145': '#ef4444',  // red-500
      'PSY': '#f59e0b',      // amber-500
      'PSY-100': '#f59e0b',  // amber-500
      'LIFE': '#10b981',     // emerald-500
      'LIFE-102': '#10b981', // emerald-500
      'LIFE-102-L': '#10b981', // emerald-500
      'MU': '#8b5cf6',       // violet-500
      'MU-100': '#8b5cf6',   // violet-500
      'MATH': '#06b6d4',     // cyan-500
      'MATH-118': '#06b6d4', // cyan-500
    };
    
    // Direct match first
    if (extractedCourseCode && typeof extractedCourseCode === 'string' && colorMappings[extractedCourseCode]) {
      return colorMappings[extractedCourseCode];
    }
    
    // Try base code match (e.g., PSY from PSY-100)
    if (extractedCourseCode && typeof extractedCourseCode === 'string') {
      const baseCode = extractedCourseCode.split('-')[0];
      if (colorMappings[baseCode]) {
        return colorMappings[baseCode];
      }
    }
    
    // Generate consistent color for unknown courses using hash
    const courseColors = [
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#06b6d4', // cyan-500
      '#f97316', // orange-500
      '#10b981', // emerald-500
      '#ec4899', // pink-500
    ];
    
    // Simple hash function
    let hash = 0;
    const textToHash = (extractedCourseCode && typeof extractedCourseCode === 'string') ? extractedCourseCode : title;
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

  const predefinedColors = [
    '#ef4444', // red-500
    '#f97316', // orange-500  
    '#f59e0b', // amber-500
    '#eab308', // yellow-500
    '#84cc16', // lime-500
    '#22c55e', // green-500
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#0ea5e9', // sky-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#a855f7', // purple-500
    '#d946ef', // fuchsia-500
    '#ec4899', // pink-500
    '#f43f5e', // rose-500
    '#6b7280', // gray-500
  ];

  const renderColorEditTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Edit Course Colors</h2>
        <p className="text-muted-foreground">
          Click on a course to customize its color, or select from predefined colors below
        </p>
      </div>

      <div className="grid gap-4">
        {courses.map((course) => (
          <Card 
            key={course.code}
            className={`border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedCourseForColor === course.code ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
            style={{ 
              backgroundColor: typeof course.color === 'string' ? course.color : '#6b7280',
              borderColor: typeof course.color === 'string' ? course.color : '#6b7280',
              color: 'white'
            }}
            onClick={() => {
              console.log('Course clicked:', course.code);
              setSelectedCourseForColor(course.code);
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <course.icon className="h-6 w-6" />
                  <div>
                    <CardTitle className="text-lg">{course.code}</CardTitle>
                    <p className="text-sm opacity-80">
                      {course.totalAssignments} assignments
                    </p>
                  </div>
                </div>
                {selectedCourseForColor === course.code && (
                  <Badge variant="outline" className="bg-background/50">
                    Selected
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {selectedCourseForColor && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Choose Color for {selectedCourseForColor}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Predefined Colors</h4>
                <div className="grid grid-cols-5 gap-3">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      className="w-12 h-12 rounded-lg border-2 border-border hover:border-primary transition-colors duration-200 hover:scale-105 transform"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        console.log('Color selected:', color, 'for course:', selectedCourseForColor);
                        handleCourseColorChange(selectedCourseForColor, color);
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-3">Custom Color</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer"
                    onChange={(e) => {
                      console.log('Custom color selected:', e.target.value, 'for course:', selectedCourseForColor);
                      handleCourseColorChange(selectedCourseForColor, e.target.value);
                    }}
                    title="Pick a custom color"
                  />
                  <p className="text-sm text-muted-foreground">
                    Click to pick any color you want
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

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
          {!isReorderMode && activeTab === "courses" && (
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
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetCourseOrder}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Reset All
              </Button>
            </>
          )}
          {isReorderMode && (
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="colors">Edit Course Colors</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="colors">
          {renderColorEditTab()}
        </TabsContent>
      </Tabs>
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
      style={{
        ...style,
        backgroundColor: typeof course.color === 'string' ? course.color : '#6b7280',
        borderColor: typeof course.color === 'string' ? course.color : '#6b7280',
        color: 'white'
      }} 
      className={`border-2 transition-opacity duration-150 ${
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
