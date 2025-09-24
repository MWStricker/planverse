import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Clock, BookOpen, CheckCircle, Calendar as CalendarIcon, Navigation } from "lucide-react";
import { format, addDays, subDays, isToday, getHours, startOfDay, isSameDay } from "date-fns";
import { EventTaskModal } from "./EventTaskModal";

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
  source_provider?: string;
}

interface DailyCalendarViewProps {
  events: Event[];
  tasks: Task[];
  storedColors?: Record<string, string>;
  currentDay: Date;
  setCurrentDay: (date: Date) => void;
}

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => ({
  label: i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
  hour: i
}));

const getEventColorClass = (title: string) => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes("fitness") || lowerTitle.includes("workout")) {
    return "bg-gradient-to-r from-red-100 to-red-200 border-l-4 border-l-red-400 text-red-700 shadow-md";
  }
  
  if (lowerTitle.includes("write") || lowerTitle.includes("writing")) {
    return "bg-gradient-to-r from-amber-50 to-yellow-100 border-l-4 border-l-amber-400 text-amber-700 shadow-md";
  }
  
  if (lowerTitle.includes("travel") || lowerTitle.includes("validation")) {
    return "bg-gradient-to-r from-cyan-50 to-cyan-100 border-l-4 border-l-cyan-400 text-cyan-700 shadow-md";
  }
  
  if (lowerTitle.includes("book") || lowerTitle.includes("ticket")) {
    return "bg-gradient-to-r from-blue-100 to-blue-200 border-l-4 border-l-blue-500 text-blue-800 shadow-md";
  }
  
  if (lowerTitle.includes("agency") || lowerTitle.includes("work") || lowerTitle.includes("weekly")) {
    return "bg-gradient-to-r from-indigo-50 to-indigo-100 border-l-4 border-l-indigo-400 text-indigo-700 shadow-md";
  }
  
  if (lowerTitle.includes("lunch") || lowerTitle.includes("dinner") || lowerTitle.includes("food")) {
    return "bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-l-orange-400 text-orange-700 shadow-md";
  }
  
  if (lowerTitle.includes("learn") || lowerTitle.includes("class") || lowerTitle.includes("lesson")) {
    return "bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-l-purple-400 text-purple-700 shadow-md";
  }
  
  if (lowerTitle.includes("done")) {
    return "bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-l-gray-400 text-gray-600 shadow-md opacity-75";
  }
  
  return "bg-gradient-to-r from-slate-50 to-slate-100 border-l-4 border-l-slate-400 text-slate-700 shadow-md";
};

const getTaskColorClass = (task: Task) => {
  if (task.completion_status === 'completed') {
    return "bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-l-green-400 text-green-700 shadow-md opacity-75";
  }
  
  const priority = task.priority_score || 0;
  if (priority >= 3) {
    return "bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-l-red-400 text-red-700 shadow-md";
  } else if (priority >= 2) {
    return "bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-l-amber-400 text-amber-700 shadow-md";
  }
  
  return "bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-l-blue-400 text-blue-700 shadow-md";
};

export const DailyCalendarView = ({ events, tasks, currentDay, setCurrentDay }: DailyCalendarViewProps) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToCurrentHour = () => {
    if (scrollContainerRef.current && isToday(currentDay)) {
      const currentHour = getHours(new Date());
      const hourElement = scrollContainerRef.current.querySelector(`[data-hour="${currentHour}"]`);
      if (hourElement) {
        hourElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Auto-scroll to current time when component loads or day changes
  useEffect(() => {
    // Small delay to ensure the DOM is fully rendered
    const timer = setTimeout(() => {
      scrollToCurrentHour();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [currentDay]);
  
  const handlePrevDay = () => setCurrentDay(subDays(currentDay, 1));
  const handleNextDay = () => setCurrentDay(addDays(currentDay, 1));
  const handleToday = () => setCurrentDay(new Date());

  const handleCellClick = (hour: number) => {
    setSelectedDate(currentDay);
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
  
  const getItemsForTimeSlot = (hour: number) => {
    const dayEvents = events.filter(event => {
      if (!event.start_time) return false;
      
      // Special handling for Canvas 23:59:59+00:00 events - they should appear at 23:59 (11:59 PM)
      if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
        return isSameDay(new Date(event.start_time), currentDay) && hour === 23;
      }
      
      const eventDate = new Date(event.start_time);
      const eventHour = eventDate.getHours();
      return isSameDay(eventDate, currentDay) && eventHour === hour;
    });
    
    const dayTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      
      // Special handling for Canvas 23:59:59+00:00 tasks - they should appear at 23:59 (11:59 PM)
      if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
        return isSameDay(new Date(task.due_date), currentDay) && hour === 23;
      }
      
      const taskDate = new Date(task.due_date);
      const taskHour = taskDate.getHours();
      return isSameDay(taskDate, currentDay) && taskHour === hour;
    });
    
    return { events: dayEvents, tasks: dayTasks };
  };

  const allDayEvents = events.filter(event => {
    if (!event.start_time) return false;
    const eventDate = new Date(event.start_time);
    return isSameDay(eventDate, currentDay) && (
      // Only include Canvas events with 23:59:59 as all-day events
      // Regular events created at 12:00 AM should appear in their time slot
      (event.source_provider === 'canvas' && event.start_time.includes('23:59:59'))
    );
  });

  const allDayTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    const taskDate = new Date(task.due_date);
    return isSameDay(taskDate, currentDay) && (
      // Only include Canvas tasks with 23:59:59 as all-day tasks
      // Regular tasks created at 12:00 AM should appear in their time slot
      (task.source_provider === 'canvas' && task.due_date.includes('23:59:59'))
    );
  });

  return (
    <div className="w-full max-w-4xl mx-auto" style={{ 
      transform: 'translate3d(0, 0, 0)',
      backfaceVisibility: 'hidden',
      contain: 'layout style'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {format(currentDay, "EEEE")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Daily Planner</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday(currentDay) ? "default" : "outline"} size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {isToday(currentDay) && (
            <Button variant="outline" size="sm" onClick={scrollToCurrentHour} className="flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Jump to Now
            </Button>
          )}
        </div>
      </div>

      {/* All Day Events/Tasks */}
      {(allDayEvents.length > 0 || allDayTasks.length > 0) && (
        <div className="mb-6 bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            All Day
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg cursor-pointer hover:scale-[1.02] transition-all duration-200 ${getEventColorClass(event.title)}`}
                onClick={() => handleEventClick(event)}
              >
                <div className="font-semibold text-sm mb-1">{event.title}</div>
                <div className="text-xs opacity-80">
                  {event.start_time ? (() => {
                    // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                    if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                      // For Canvas events that end at 23:59:59+00:00, show 11:59 PM
                      return "11:59 PM";
                    }
                    
                    const date = new Date(event.start_time);
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  })() : 'All day event'}
                </div>
              </div>
            ))}
            {allDayTasks.map((task) => (
              <div
                key={task.id}
                className={`p-3 rounded-lg cursor-pointer hover:scale-[1.02] transition-all duration-200 ${getTaskColorClass(task)}`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                  {task.completion_status === 'completed' ? 
                    <CheckCircle className="h-4 w-4" /> : 
                    <BookOpen className="h-4 w-4" />
                  }
                  {task.title}
                </div>
                <div className="text-xs opacity-80 space-y-1">
                  <div>
                    Due: {task.due_date ? (() => {
                      // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                      if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
                        return "11:59 PM";
                      }
                      const date = new Date(task.due_date);
                      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    })() : 'Today'}
                  </div>
                  {task.course_name && (
                    <div>Course: {task.course_name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Schedule */}
      <div ref={scrollContainerRef} className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden shadow-lg max-h-[600px] overflow-y-auto" style={{ 
        scrollBehavior: 'smooth', 
        transform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        willChange: 'scroll-position, transform',
        contain: 'layout style paint',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}>
        {TIME_SLOTS.map((timeSlot, index) => {
          const { events: slotEvents, tasks: slotTasks } = getItemsForTimeSlot(timeSlot.hour);
          const isCurrentHour = isToday(currentDay) && getHours(new Date()) === timeSlot.hour;
          const hasItems = slotEvents.length > 0 || slotTasks.length > 0;
          
          return (
            <div 
              key={timeSlot.hour} 
              data-hour={timeSlot.hour}
              className={`flex border-b border-border/30 last:border-b-0 group/hour ${
                isCurrentHour ? "bg-gradient-to-r from-primary/5 to-primary/10 ring-1 ring-primary/20" : ""
              }`}
            >
              {/* Time Label */}
              <div className="w-32 flex-shrink-0 p-4 border-r border-border/40 bg-muted/10 flex items-start justify-center">
                <div className={`text-sm font-medium px-2 py-1 rounded-md ${
                  isCurrentHour 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "bg-background/80 text-muted-foreground border border-border/50"
                }`}>
                  {timeSlot.label}
                </div>
              </div>
              
              {/* Content Area */}
              <div 
                className={`flex-1 min-h-[80px] p-3 cursor-pointer transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${
                  !hasItems ? "hover:bg-accent/20 hover:shadow-sm" : ""
                }`}
                style={{ 
                  transform: 'translate3d(0, 0, 0)',
                  backfaceVisibility: 'hidden',
                  contain: 'layout style'
                }}
                onClick={() => !hasItems && handleCellClick(timeSlot.hour)}
              >
                {/* Current time indicator */}
                {isCurrentHour && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary shadow-sm shadow-primary/50"></div>
                )}
                
                {/* Add button for empty slots */}
                {!hasItems && (
                  <div className="flex items-center justify-center h-full opacity-0 group-hover/hour:opacity-60 transition-all duration-200">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Plus className="h-4 w-4" />
                      Add event or task
                    </div>
                  </div>
                )}
                
                {/* Events and Tasks */}
                <div className="space-y-2">
                  {slotEvents.map((event, eventIndex) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg cursor-pointer hover:scale-[1.02] transition-all duration-200 ${getEventColorClass(event.title)} animate-fade-in`}
                      style={{ animationDelay: `${eventIndex * 50}ms` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                    >
                      <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {event.title}
                      </div>
                      <div className="text-xs opacity-80">
                        {event.start_time ? (() => {
                          // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                          if (event.source_provider === 'canvas' && event.start_time.includes('23:59:59+00')) {
                            return "11:59 PM";
                          }
                          const date = new Date(event.start_time);
                          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        })() : 'All day'}
                      </div>
                    </div>
                  ))}
                  
                  {slotTasks.map((task, taskIndex) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg cursor-pointer hover:scale-[1.02] transition-all duration-200 ${getTaskColorClass(task)} animate-fade-in`}
                      style={{ animationDelay: `${(slotEvents.length + taskIndex) * 50}ms` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task);
                      }}
                    >
                      <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                        {task.completion_status === 'completed' ? 
                          <CheckCircle className="h-4 w-4" /> : 
                          <BookOpen className="h-4 w-4" />
                        }
                        {task.title}
                      </div>
                      <div className="text-xs opacity-80 space-y-1">
                        <div>
                          Due: {task.due_date ? (() => {
                            // Check if this is a Canvas 23:59:59+00:00 time BEFORE parsing the date
                            if (task.source_provider === 'canvas' && task.due_date.includes('23:59:59+00')) {
                              return "11:59 PM";
                            }
                            const date = new Date(task.due_date);
                            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                          })() : 'Today'}
                        </div>
                        {task.course_name && (
                          <div>Course: {task.course_name}</div>
                        )}
                        {task.priority_score && (
                          <div>Priority: {task.priority_score}/10</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
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