import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday, getHours } from "date-fns";
import { EventTaskModal } from "./EventTaskModal";
import { useProfile } from "@/hooks/useProfile";
import { toUserTimezone } from "@/lib/timezone-utils";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type: string;
  source_provider?: string;
  is_all_day?: boolean;
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
  currentWeek: Date;
  setCurrentWeek: (date: Date) => void;
}

const TIME_SLOTS = [
  { label: "12am", hour: 0 },
  { label: "4am", hour: 4 },
  { label: "5am", hour: 5 },
  { label: "6am", hour: 6 },
  { label: "7am", hour: 7 },
  { label: "8am", hour: 8 },
  { label: "9am", hour: 9 },
  { label: "10am", hour: 10 },
  { label: "11am", hour: 11 },
  { label: "12pm", hour: 12 },
  { label: "1pm", hour: 13 },
  { label: "2pm", hour: 14 },
  { label: "3pm", hour: 15 },
  { label: "4pm", hour: 16 },
  { label: "5pm", hour: 17 },
  { label: "6pm", hour: 18 },
  { label: "7pm", hour: 19 },
  { label: "8pm", hour: 20 },
  { label: "9pm", hour: 21 },
  { label: "10pm", hour: 22 },
  { label: "11pm", hour: 23 }
];

const getEventColorClass = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes("fitness") || lowerTitle.includes("workout")) {
    return "bg-gradient-to-br from-red-100 to-red-200 border-l-4 border-l-red-400 text-red-700 shadow-sm";
  }
  
  if (lowerTitle.includes("write") || lowerTitle.includes("writing")) {
    return "bg-gradient-to-br from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm";
  }
  
  if (lowerTitle.includes("travel") || lowerTitle.includes("validation")) {
    return "bg-gradient-to-br from-cyan-50 to-cyan-100 border-l-4 border-l-cyan-400 text-cyan-700 shadow-sm";
  }
  
  if (lowerTitle.includes("book") || lowerTitle.includes("ticket")) {
    return "bg-gradient-to-br from-blue-100 to-blue-200 border-l-4 border-l-blue-500 text-blue-800 shadow-sm";
  }
  
  if (lowerTitle.includes("agency") || lowerTitle.includes("work") || lowerTitle.includes("weekly")) {
    return "bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-l-indigo-400 text-indigo-700 shadow-sm";
  }
  
  if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("food")) {
    return "bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-l-orange-400 text-orange-700 shadow-sm";
  }
  
  if (lowerTitle.includes("learn") || lowerTitle.includes("class") || lowerTitle.includes("lesson")) {
    return "bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-l-purple-400 text-purple-700 shadow-sm";
  }
  
  if (lowerTitle.includes("done")) {
    return "bg-gradient-to-br from-gray-50 to-gray-100 border-l-4 border-l-gray-400 text-gray-600 shadow-sm opacity-75";
  }
  
  return "bg-gradient-to-br from-slate-50 to-slate-100 border-l-4 border-l-slate-400 text-slate-700 shadow-sm";
};

export const WeeklyCalendarView = ({ events, tasks, currentWeek, setCurrentWeek }: WeeklyCalendarViewProps) => {
  const { profile } = useProfile();
  const userTimezone = profile?.timezone || 'America/New_York';
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleCellClick = (day: Date, hour: number) => {
    setSelectedDate(day);
    setSelectedHour(hour);
    setSelectedEvent(null);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedTask(null);
    setSelectedDate(null);
    setSelectedHour(null);
  };
  
  const getItemsForTimeSlot = (day: Date, hour: number) => {
    const dayEvents = events.filter(event => {
      if (!event.start_time) return false;
      // Convert UTC timestamp to user's timezone
      const eventDate = toUserTimezone(event.start_time, userTimezone);
      const eventHour = eventDate.getHours();
      return isSameDay(eventDate, day) && eventHour === hour;
    });
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      // Convert UTC timestamp to user's timezone
      const taskDate = toUserTimezone(task.due_date, userTimezone);
      const taskHour = taskDate.getHours();
      return isSameDay(taskDate, day) && taskHour === hour;
    });
    
    return { events: dayEvents, tasks: dayTasks };
  };

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    return isSameDay(weekStart, todayWeekStart);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mx-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {format(weekStart, "MMMM d")} - {format(weekEnd, "d, yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Weekly Schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isCurrentWeek() ? "default" : "outline"} size="sm" onClick={handleToday}>
            This Week
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden shadow-lg" style={{
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        contain: 'layout style paint'
      }}>
        {/* Header Row */}
        <div className="grid grid-cols-8 bg-gradient-to-r from-muted/30 to-muted/50 backdrop-blur-sm">
          <div className="p-3 text-xs font-medium text-muted-foreground border-r border-border/40 bg-muted/20">
            <div className="text-center">Time</div>
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-3 text-center border-r border-border/40 last:border-r-0 relative overflow-hidden ${
                isToday(day) 
                  ? "bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-semibold" 
                  : "bg-transparent"
              }`}
            >
              {isToday(day) && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
              )}
              <div className="text-sm font-semibold relative z-10">
                {format(day, "EEE")}
              </div>
              <div className={`text-lg font-bold relative z-10 ${
                isToday(day) ? "text-primary" : "text-foreground"
              }`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time Slots */}
        {TIME_SLOTS.map((timeSlot, index) => (
          <div key={timeSlot.hour} className="grid grid-cols-8 group/row">
            {/* Time Label */}
            <div className="p-3 text-xs font-medium text-muted-foreground border-r border-b border-border/30 bg-muted/10 text-center flex items-center justify-center relative">
              <div className="bg-background/80 px-2 py-1 rounded-md shadow-sm border border-border/50">
                {timeSlot.label}
              </div>
              {index % 4 === 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/20"></div>
              )}
            </div>
            
            {/* Day Cells */}
            {weekDays.map((day) => {
              const { events: slotEvents, tasks: slotTasks } = getItemsForTimeSlot(day, timeSlot.hour);
              const cellKey = `${day.toISOString()}-${timeSlot.hour}`;
              const isCurrentHour = isToday(day) && getHours(new Date()) === timeSlot.hour;
              
              return (
                <div
                  key={cellKey}
                  className={`min-h-[60px] border-r border-b border-border/30 last:border-r-0 p-2 space-y-1.5 cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] relative group/cell ${
                    isCurrentHour 
                      ? "bg-gradient-to-br from-primary/5 to-primary/10 ring-1 ring-primary/20" 
                      : "hover:bg-accent/20 hover:shadow-sm"
                  } ${index % 4 === 0 ? "border-t-border/50" : ""}`}
                  style={{
                    transform: 'translate3d(0, 0, 0)',
                    backfaceVisibility: 'hidden',
                    contain: 'layout style'
                  }}
                  onClick={() => handleCellClick(day, timeSlot.hour)}
                  title={`${format(day, 'MMM d')} at ${timeSlot.label} - Click to add event`}
                >
                  {/* Current time indicator */}
                  {isCurrentHour && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-sm shadow-primary/50"></div>
                  )}
                  
                  {/* Add icon for empty cells */}
                  {slotEvents.length === 0 && slotTasks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-50 transition-all duration-200 pointer-events-none">
                      <div className="w-6 h-6 rounded-full bg-muted/40 flex items-center justify-center">
                        <div className="text-muted-foreground text-sm font-medium">+</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Events */}
                  {slotEvents.map((event, eventIndex) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-lg text-xs cursor-pointer hover:scale-[1.02] transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 ${getEventColorClass(event.title)}`}
                      style={{ 
                        animationDelay: `${eventIndex * 50}ms`,
                        transform: 'translate3d(0, 0, 0)',
                        backfaceVisibility: 'hidden'
                      }}
                      title={`Click to view event: ${event.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                    >
                      <div className="font-semibold leading-tight truncate mb-1">{event.title}</div>
                       <div className="text-xs opacity-80 truncate flex items-center gap-1">
                         <span className="w-1 h-1 rounded-full bg-current opacity-60"></span>
                          {event.is_all_day ? 'All day' : (() => {
                            const startDate = new Date(event.start_time);
                            const endDate = new Date(event.end_time);
                            
                            // Handle special Canvas events
                            if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                              const fixedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
                              const fixedEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
                              const startTime = fixedStartDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                              const endTime = fixedEndDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                              return `${startTime} - ${endTime}`;
                            }
                            
                            const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            return `${startTime} - ${endTime}`;
                          })()}
                       </div>
                    </div>
                  ))}
                  
                  {/* Tasks */}
                  {slotTasks.map((task, taskIndex) => (
                    <div
                      key={task.id}
                      className="p-2 rounded-lg text-xs bg-gradient-to-br from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-sm cursor-pointer hover:scale-[1.02] transition-all duration-200 relative z-10 animate-fade-in"
                      style={{ animationDelay: `${(slotEvents.length + taskIndex) * 50}ms` }}
                      title={`Click to view task: ${task.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task);
                      }}
                    >
                      <div className="font-semibold leading-tight truncate mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {task.title}
                      </div>
                      <div className="text-xs opacity-70 truncate">
                        Due: {task.due_date ? new Date(task.due_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Today'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Event/Task Modal */}
      <EventTaskModal
        isOpen={isModalOpen}
        onClose={closeModal}
        event={selectedEvent || undefined}
        task={selectedTask || undefined}
        selectedDate={selectedDate || undefined}
        selectedHour={selectedHour || undefined}
      />
    </div>
  );
};