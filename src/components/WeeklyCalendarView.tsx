import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday, parseISO, isSameHour } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  event_type: string;
  source_provider?: string;
}

interface Task {
  id: string;
  title: string;
  due_date?: string;
  priority_score?: number;
  completion_status?: string;
  course_name?: string;
}

interface WeeklyCalendarViewProps {
  events: Event[];
  tasks: Task[];
  storedColors?: Record<string, string>;
}

const timeSlots = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
];

const getCourseColor = (title: string, isCanvas: boolean, courseCode?: string, storedColors?: Record<string, string>) => {
  if (!isCanvas) return 'bg-blue-100 border-blue-200 text-blue-800';
  
  const extractedCourseCode = courseCode || extractCourseCode(title, isCanvas);
  if (!extractedCourseCode) return 'bg-blue-100 border-blue-200 text-blue-800';
  
  if (storedColors && storedColors[extractedCourseCode]) {
    const color = storedColors[extractedCourseCode];
    return `bg-[${color}]/20 border-[${color}]/30 text-[${color}]`;
  }
  
  const colorMappings: Record<string, string> = {
    'HES': 'bg-red-100 border-red-200 text-red-800',
    'LIFE': 'bg-green-100 border-green-200 text-green-800',
    'MATH': 'bg-amber-100 border-amber-200 text-amber-800',
    'PSY': 'bg-purple-100 border-purple-200 text-purple-800',
    'PHIL': 'bg-indigo-100 border-indigo-200 text-indigo-800',
  };
  
  for (const [prefix, colorClass] of Object.entries(colorMappings)) {
    if (extractedCourseCode.startsWith(prefix)) {
      return colorClass;
    }
  }
  
  return 'bg-blue-100 border-blue-200 text-blue-800';
};

const extractCourseCode = (title: string, isCanvas: boolean = false) => {
  if (!isCanvas) return null;
  const courseMatch = title.match(/\[([A-Z0-9]+-)?([A-Z]+-\d+)/);
  if (courseMatch) {
    return courseMatch[2];
  }
  return null;
};

export const WeeklyCalendarView = ({ events, tasks, storedColors }: WeeklyCalendarViewProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(direction === 'prev' ? subWeeks(currentWeek, 1) : addWeeks(currentWeek, 1));
  };
  
  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter(event => {
      if (!event.start_time) return false;
      const eventDate = parseISO(event.start_time);
      const eventHour = eventDate.getHours();
      return isSameDay(eventDate, day) && eventHour === hour;
    });
  };
  
  const getTasksForDayAndHour = (day: Date, hour: number) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      const taskHour = taskDate.getHours();
      return isSameDay(taskDate, day) && taskHour === hour;
    });
  };
  
  const timeSlotToHour = (timeSlot: string) => {
    const hour = parseInt(timeSlot.split(':')[0]);
    const isPM = timeSlot.includes('PM');
    return isPM && hour !== 12 ? hour + 12 : hour === 12 && !isPM ? 0 : hour;
  };

  return (
    <div className="w-full">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* Header row with days */}
        <div className="grid grid-cols-8 border-b bg-muted/30">
          <div className="p-3 text-sm font-medium text-muted-foreground border-r">
            GMT+08
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-3 text-center border-r last:border-r-0 ${
                isToday(day) ? 'bg-primary/10 text-primary font-semibold' : ''
              }`}
            >
              <div className="text-sm font-medium">
                {format(day, 'EEE')} {format(day, 'M/d')}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots and events */}
        <div className="grid grid-cols-8">
          {timeSlots.map((timeSlot) => {
            const hour = timeSlotToHour(timeSlot);
            
            return (
              <div key={timeSlot} className="contents">
                {/* Time slot label */}
                <div className="p-2 text-sm text-muted-foreground border-r border-b bg-muted/10 text-right">
                  {timeSlot.replace(':00', '')}
                </div>
                
                {/* Day columns */}
                {weekDays.map((day) => {
                  const dayEvents = getEventsForDayAndHour(day, hour);
                  const dayTasks = getTasksForDayAndHour(day, hour);
                  
                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="min-h-[60px] p-1 border-r border-b last:border-r-0 relative"
                    >
                      {/* Events */}
                      {dayEvents.map((event) => {
                        const isCanvas = event.source_provider === 'canvas';
                        const courseColor = getCourseColor(
                          event.title,
                          isCanvas,
                          extractCourseCode(event.title, isCanvas),
                          storedColors
                        );
                        
                        return (
                          <div
                            key={event.id}
                            className={`mb-1 p-1 rounded text-xs border ${courseColor} cursor-pointer hover:opacity-80 transition-opacity`}
                            title={event.title}
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            {event.start_time && (
                              <div className="text-xs opacity-70">
                                {format(parseISO(event.start_time), 'h:mm a')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Tasks */}
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className="mb-1 p-1 rounded text-xs bg-yellow-100 border border-yellow-200 text-yellow-800 cursor-pointer hover:opacity-80 transition-opacity"
                          title={task.title}
                        >
                          <div className="font-medium truncate">{task.title}</div>
                          {task.due_date && (
                            <div className="text-xs opacity-70">
                              Due: {format(parseISO(task.due_date), 'h:mm a')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};