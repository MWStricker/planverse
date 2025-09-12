import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday, parseISO, getHours, getMinutes } from "date-fns";

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
  { label: '8am', hour: 8 },
  { label: '9am', hour: 9 },
  { label: '10am', hour: 10 },
  { label: '11am', hour: 11 },
  { label: '12pm', hour: 12 },
  { label: '1pm', hour: 13 },
  { label: '2pm', hour: 14 },
  { label: '3pm', hour: 15 },
  { label: '4pm', hour: 16 },
  { label: '5pm', hour: 17 },
  { label: '6pm', hour: 18 },
  { label: '7pm', hour: 19 },
  { label: '8pm', hour: 20 },
  { label: '9pm', hour: 21 }
];

const getEventColor = (title: string, eventType: string, sourceProvider?: string) => {
  // Fitness-related events (pink/red family)
  if (title.toLowerCase().includes("fitness") || title.toLowerCase().includes("workout")) {
    return "bg-red-200 border-red-300 text-red-800";
  }
  
  // Writing/academic related (yellow family)
  if (title.toLowerCase().includes("write") || title.toLowerCase().includes("writing") || title.toLowerCase().includes("publish")) {
    return "bg-yellow-200 border-yellow-300 text-yellow-800";
  }
  
  // Travel/validation related (cyan family)
  if (title.toLowerCase().includes("travel") || title.toLowerCase().includes("validation")) {
    return "bg-cyan-200 border-cyan-300 text-cyan-800";
  }
  
  // Booking/tickets (blue family)
  if (title.toLowerCase().includes("book") || title.toLowerCase().includes("ticket")) {
    return "bg-blue-400 border-blue-500 text-white";
  }
  
  // Agency/work related (light blue family)
  if (title.toLowerCase().includes("agency") || title.toLowerCase().includes("work") || title.toLowerCase().includes("weekly") || title.toLowerCase().includes("commons")) {
    return "bg-blue-200 border-blue-300 text-blue-800";
  }
  
  // Food/dining (orange family)
  if (title.toLowerCase().includes("lunch") || title.toLowerCase().includes("dinner") || title.toLowerCase().includes("food") || title.toLowerCase().includes("salad")) {
    return "bg-orange-200 border-orange-300 text-orange-800";
  }
  
  // Learning/education (purple family)
  if (title.toLowerCase().includes("learn") || title.toLowerCase().includes("class") || title.toLowerCase().includes("lesson")) {
    return "bg-purple-200 border-purple-300 text-purple-800";
  }
  
  // Testing/validation (light green family)
  if (title.toLowerCase().includes("test") || title.toLowerCase().includes("testing")) {
    return "bg-green-200 border-green-300 text-green-800";
  }
  
  // DONE tasks (light gray)
  if (title.toLowerCase().includes("done")) {
    return "bg-gray-200 border-gray-300 text-gray-700";
  }
  
  // Default colors based on event type
  switch (eventType) {
    case "assignment":
      return "bg-red-300 border-red-400 text-red-900";
    case "exam":
      return "bg-red-400 border-red-500 text-white";
    case "class":
      return "bg-blue-200 border-blue-300 text-blue-800";
    default:
      return "bg-gray-200 border-gray-300 text-gray-800";
  }
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
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 }); // Start on Sunday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek(direction === "prev" ? subWeeks(currentWeek, 1) : addWeeks(currentWeek, 1));
  };
  
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      if (!event.start_time) return false;
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, day);
    }).map(event => {
      const startDate = parseISO(event.start_time);
      const endDate = event.end_time ? parseISO(event.end_time) : startDate;
      const startHour = getHours(startDate);
      const startMinute = getMinutes(startDate);
      const endHour = getHours(endDate);
      const endMinute = getMinutes(endDate);
      
      // Calculate position and height
      const startSlotIndex = timeSlots.findIndex(slot => slot.hour >= startHour);
      const endSlotIndex = timeSlots.findIndex(slot => slot.hour > endHour) - 1;
      
      return {
        ...event,
        startSlotIndex: startSlotIndex >= 0 ? startSlotIndex : 0,
        endSlotIndex: endSlotIndex >= 0 ? endSlotIndex : startSlotIndex >= 0 ? startSlotIndex : 0,
        startMinute,
        endMinute,
        duration: Math.max(1, endSlotIndex - startSlotIndex + 1)
      };
    });
  };
  
  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
  };

  return (
    <div className="w-full">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekly grid */}
      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
        {/* Header row with days */}
        <div className="grid grid-cols-8 bg-gray-50">
          <div className="p-2 text-xs text-gray-600 border-r border-gray-300 bg-gray-100">
            GMT+08
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-r border-gray-300 last:border-r-0 ${
                isToday(day) ? "bg-blue-100 text-blue-800 font-semibold" : "bg-gray-50"
              }`}
            >
              <div className="text-sm font-medium">
                {format(day, "EEE")} {format(day, "M/d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots and events */}
        {timeSlots.map((timeSlot, timeIndex) => (
          <div key={timeSlot.hour} className="grid grid-cols-8 relative">
            {/* Time slot label */}
            <div className="p-2 text-xs text-gray-600 border-r border-b border-gray-300 bg-gray-50 text-right font-medium">
              {timeSlot.label}
            </div>
            
            {/* Day columns */}
            {weekDays.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day);
              const dayTasks = getTasksForDay(day);
              
              // Find events that should appear in this time slot
              const slotEvents = dayEvents.filter(event => 
                timeIndex >= event.startSlotIndex && timeIndex <= event.endSlotIndex
              );
              
              // Only show the event in its starting slot to avoid duplicates
              const startingEvents = slotEvents.filter(event => 
                timeIndex === event.startSlotIndex
              );
              
              return (
                <div
                  key={`${day.toISOString()}-${timeSlot.hour}`}
                  className="min-h-[50px] border-r border-b border-gray-300 last:border-r-0 relative p-1"
                >
                  {/* Events that start in this slot */}
                  {startingEvents.map((event) => {
                    const eventColor = getEventColor(event.title, event.event_type, event.source_provider);
                    const height = event.duration * 50; // 50px per slot
                    
                    return (
                      <div
                        key={event.id}
                        className={`absolute left-1 right-1 rounded text-xs border ${eventColor} cursor-pointer hover:opacity-80 transition-opacity z-10 p-1`}
                        style={{ 
                          height: `${height - 2}px`,
                          top: '2px'
                        }}
                        title={event.title}
                      >
                        <div className="font-medium text-xs leading-tight break-words">
                          {event.title}
                        </div>
                        {event.start_time && (
                          <div className="text-xs opacity-80 mt-0.5 break-words">
                            {format(parseISO(event.start_time), "h:mm a")}
                            {event.end_time && event.start_time !== event.end_time && (
                              <span> - {format(parseISO(event.end_time), "h:mm a")}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Tasks for this time slot */}
                  {dayTasks.filter(task => {
                    if (!task.due_date) return false;
                    const taskDate = parseISO(task.due_date);
                    const taskHour = getHours(taskDate);
                    return taskHour === timeSlot.hour;
                  }).map((task, taskIndex) => (
                    <div
                      key={task.id}
                      className="mb-1 p-1 rounded text-xs bg-yellow-200 border border-yellow-300 text-yellow-800 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ 
                        marginTop: `${startingEvents.length * 52}px` // Offset by events
                      }}
                      title={task.title}
                    >
                      <div className="font-medium text-xs break-words">{task.title}</div>
                      {task.due_date && (
                        <div className="text-xs opacity-70 break-words">
                          Due: {format(parseISO(task.due_date), "h:mm a")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};