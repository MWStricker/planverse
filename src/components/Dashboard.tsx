import { Calendar, Clock, BookOpen, Target, Upload, Plus, CheckCircle, AlertCircle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  course: string;
  courseColor: string;
  dueDate: string;
  estimatedHours: number;
  priority: 'high' | 'medium' | 'low';
  workloadReason: string;
  completed: boolean;
}

interface ScheduleEvent {
  id: string;
  title: string;
  time: string;
  location: string;
  type: 'class' | 'exam' | 'study' | 'personal';
  course?: string;
  courseColor?: string;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Data Structures Project',
    course: 'CS 250',
    courseColor: 'course-cs',
    dueDate: 'Tomorrow 11:59 PM',
    estimatedHours: 6,
    priority: 'high',
    workloadReason: 'High complexity + due in 24h',
    completed: false,
  },
  {
    id: '2',
    title: 'Calculus Problem Set 8',
    course: 'MATH 201',
    courseColor: 'course-math',
    dueDate: 'Friday 5:00 PM',
    estimatedHours: 3,
    priority: 'medium',
    workloadReason: 'Medium length, familiar format',
    completed: false,
  },
  {
    id: '3',
    title: 'Read Chapter 12: Organic Chemistry',
    course: 'CHEM 305',
    courseColor: 'course-science',
    dueDate: 'Next Monday',
    estimatedHours: 2,
    priority: 'low',
    workloadReason: 'Standard reading, good runway',
    completed: true,
  },
];

const todaySchedule: ScheduleEvent[] = [
  {
    id: '1',
    title: 'Data Structures',
    time: '9:00 - 10:20 AM',
    location: 'Engineering 203',
    type: 'class',
    course: 'CS 250',
    courseColor: 'course-cs',
  },
  {
    id: '2',
    title: 'Study Block (Suggested)',
    time: '10:30 - 12:00 PM',
    location: 'Library Study Room',
    type: 'study',
  },
  {
    id: '3',
    title: 'Calculus II',
    time: '2:00 - 3:20 PM',
    location: 'Math Building 105',
    type: 'class',
    course: 'MATH 201',
    courseColor: 'course-math',
  },
];

export const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const completedTasks = mockTasks.filter(task => task.completed).length;
  const totalTasks = mockTasks.length;
  const completionRate = Math.round((completedTasks / totalTasks) * 100);

  // Define suggested study blocks
  const suggestedStudyBlocks = [
    {
      id: 'morning-focus',
      title: 'Morning Focus',
      time: '10:30 AM - 12:00 PM',
      location: 'Library',
      description: 'Work on Data Structures Project',
      priority: 'Optimal',
      startTime: '10:30',
      endTime: '12:00',
      date: new Date().toISOString().split('T')[0], // Today
    },
    {
      id: 'afternoon-review',
      title: 'Afternoon Review', 
      time: '3:30 PM - 5:00 PM',
      location: 'Study Hall',
      description: 'Calculus Problem Set',
      priority: 'Good',
      startTime: '15:30',
      endTime: '17:00',
      date: new Date().toISOString().split('T')[0], // Today
    },
    {
      id: 'evening-prep',
      title: 'Evening Prep',
      time: '7:00 PM - 8:30 PM', 
      location: 'Dorm',
      description: 'Review Chemistry Notes',
      priority: 'Alternative',
      startTime: '19:00',
      endTime: '20:30',
      date: new Date().toISOString().split('T')[0], // Today
    }
  ];

  const handleAcceptStudyBlock = async (studyBlock: any) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to accept study blocks",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the study session with proper date/time formatting
      const today = new Date();
      const [startHour, startMinute] = studyBlock.startTime.split(':');
      const [endHour, endMinute] = studyBlock.endTime.split(':');
      
      const startTime = new Date(today);
      startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      
      const endTime = new Date(today);
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      const { data, error } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          title: studyBlock.title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location: studyBlock.location,
          notes: studyBlock.description,
          session_type: 'study',
          is_confirmed: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating study session:', error);
        toast({
          title: "Error",
          description: "Failed to add study block to calendar",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Study Block Added!",
          description: `${studyBlock.title} has been added to your calendar`,
        });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error", 
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Good morning! 👋</h1>
            <p className="text-muted-foreground">Here's your day at a glance</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Schedule
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Free Time Today</p>
                  <p className="text-2xl font-bold text-foreground">4.5 hrs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completedTasks}/{totalTasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due This Week</p>
                  <p className="text-2xl font-bold text-foreground">7 items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weekly Progress</p>
                  <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySchedule.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className={`w-3 h-3 rounded-full ${
                    event.type === 'class' ? `bg-${event.courseColor}` :
                    event.type === 'study' ? 'bg-accent' :
                    'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                    <p className="text-xs text-muted-foreground">{event.location}</p>
                  </div>
                  {event.type === 'study' && (
                    <Badge variant="secondary" className="bg-accent/10 text-accent">
                      Suggested
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Priority Queue */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Smart Priority Queue
                <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                  Workload-Based
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockTasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
                    task.completed ? 'bg-success/5 border-success/20' : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                      <div className={`w-2 h-2 rounded-full bg-${task.courseColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </h3>
                        <Badge variant="outline" className="text-xs">
                          {task.course}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{task.workloadReason}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Due: {task.dueDate}</span>
                        <span>Est: {task.estimatedHours}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {task.priority}
                    </Badge>
                    {task.completed && (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Suggested Study Blocks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Suggested Study Blocks
              <Badge variant="secondary" className="ml-2 bg-accent/10 text-accent">
                AI Optimized
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestedStudyBlocks.map((block, index) => (
                <div key={block.id} className={`p-4 rounded-lg ${
                  index === 0 
                    ? 'bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20'
                    : index === 1
                      ? 'bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20'
                      : 'bg-gradient-to-br from-muted/50 to-muted border border-border'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-foreground">{block.title}</h4>
                    <Badge className={
                      block.priority === 'Optimal' 
                        ? 'bg-primary text-primary-foreground'
                        : block.priority === 'Good'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-outline text-foreground'
                    }>
                      {block.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{block.time} • {block.location}</p>
                  <p className="text-sm text-foreground mb-3">{block.description}</p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className={index === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}
                      onClick={() => handleAcceptStudyBlock(block)}
                    >
                      Accept
                    </Button>
                    <Button size="sm" variant="outline">Modify</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};