import { Calendar, Clock, BookOpen, Target, Upload, Plus, CheckCircle, AlertCircle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { imageFileToBase64Compressed } from "@/lib/utils";
import { ocrExtractText } from "@/lib/ocr";

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

// Empty mock data for testing
const mockTasks: Task[] = [];

const todaySchedule: ScheduleEvent[] = [];

export const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aiSchedule, setAiSchedule] = useState<any>(null);
  const [aiPriorities, setAiPriorities] = useState<any[]>([]);
  const [aiStudyBlocks, setAiStudyBlocks] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  
  const completedTasks = userTasks.filter(task => task.completion_status === 'completed').length;
  const totalTasks = userTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate free time and due items from real data
  const freeTimeToday = userEvents.length > 0 ? "4.5 hrs" : "N/A";
  const dueThisWeek = userTasks.length > 0 ? userTasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate <= weekFromNow && task.completion_status !== 'completed';
  }).length : "N/A";

  // Fetch and analyze data on component mount
  useEffect(() => {
    if (user) {
      analyzeUserData();
    }
  }, [user]);

  const analyzeUserData = async () => {
    if (!user) return;
    
    setIsAnalyzing(true);
    try {
      // Fetch user's events, tasks, and study sessions
      const [eventsResult, tasksResult, studySessionsResult] = await Promise.all([
        supabase.from('events').select('*').eq('user_id', user.id),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('study_sessions').select('*').eq('user_id', user.id)
      ]);

      const userData = {
        events: eventsResult.data || [],
        tasks: tasksResult.data || [],
        studySessions: studySessionsResult.data || []
      };

      // Store the real data
      setUserEvents(userData.events);
      setUserTasks(userData.tasks);

      // Only run AI analysis if there's data to analyze
      if (userData.events.length > 0 || userData.tasks.length > 0) {
        // Get AI analysis for daily schedule
        const { data: scheduleAnalysis } = await supabase.functions.invoke('ai-schedule-analyzer', {
          body: {
            analysisType: 'daily_schedule',
            data: userData
          }
        });

        if (scheduleAnalysis?.success) {
          const analysis = scheduleAnalysis.analysis;
          setAiSchedule(analysis.todaySchedule || []);
          setAiPriorities(analysis.priorityInsights || []);
          setAiStudyBlocks(analysis.studyBlockSuggestions || []);
        }
      }
    } catch (error) {
      console.error('Error analyzing user data:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    toast({
      title: "Processing image...",
      description: "AI is extracting schedule information",
    });

    try {
      // Preserve PNG uploads without recompression; compress others for speed
      let base64: string;
      let mimeType: string;
      if (file.type === 'image/png') {
        base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => {
            const s = String(fr.result || '');
            resolve(s.split(',')[1] || '');
          };
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        mimeType = 'image/png';
      } else {
        const res = await imageFileToBase64Compressed(file, 1200, 'image/jpeg', 0.75);
        base64 = res.base64;
        mimeType = res.mimeType;
      }

      try {
        // Call our AI OCR edge function
        const { data: response, error } = await supabase.functions.invoke('ai-image-ocr', {
          body: { imageBase64: base64, mimeType, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, currentDate: new Date().toISOString() }
        });

        if (error) {
          console.error('OCR Error:', error);
          throw new Error('Failed to process image');
        }

        if (response.success && response.events && response.events.length > 0) {
          // Add all extracted events to the database
          const eventsToInsert = response.events.map((event: any) => {
            // Robust local date construction to avoid timezone day shifts
            const [year, month, day] = String(event.date || '').split('-').map((v: string) => parseInt(v, 10));
            const [startHour, startMinute] = String(event.startTime || '00:00').split(':').map((v: string) => parseInt(v, 10));
            const [endHour, endMinute] = String(event.endTime || '00:00').split(':').map((v: string) => parseInt(v, 10));

            const startTime = new Date(year || 1970, (month || 1) - 1, day || 1, startHour || 0, startMinute || 0, 0, 0);
            const endTime = new Date(year || 1970, (month || 1) - 1, day || 1, endHour || 0, endMinute || 0, 0, 0);

            return {
              user_id: user!.id,
              title: event.title,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              location: event.location || '',
              description: `Extracted from image with ${event.confidence}% confidence`,
              event_type: 'class',
              source_provider: 'ocr_upload',
              recurrence_rule: event.recurrence || null
            };
          });

          const { error: insertError } = await supabase
            .from('events')
            .insert(eventsToInsert);

          if (insertError) {
            console.error('Error inserting events:', insertError);
            throw new Error('Failed to save events to calendar');
          }

          toast({
            title: "Schedule uploaded successfully!",
            description: `Added ${response.events.length} events to your calendar`,
          });

          // Refresh the dashboard data
          await analyzeUserData();
        } else {
          // Fallback: client-side OCR to text then AI structuring
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const text = await ocrExtractText(file);
          const { data: textResponse, error: textError } = await supabase.functions.invoke('ai-image-ocr', {
            body: { text, timeZone: tz, currentDate: new Date().toISOString() }
          });

          if (textError) {
            throw new Error('Fallback processing failed');
          }

          if (textResponse.success && textResponse.events && textResponse.events.length > 0) {
            const eventsToInsert = textResponse.events.map((event: any) => {
              const [year, month, day] = String(event.date || '').split('-').map((v: string) => parseInt(v, 10));
              const [startHour, startMinute] = String(event.startTime || '00:00').split(':').map((v: string) => parseInt(v, 10));
              const [endHour, endMinute] = String(event.endTime || '00:00').split(':').map((v: string) => parseInt(v, 10));

              const startTime = new Date(year || 1970, (month || 1) - 1, day || 1, startHour || 0, startMinute || 0, 0, 0);
              const endTime = new Date(year || 1970, (month || 1) - 1, day || 1, endHour || 0, endMinute || 0, 0, 0);

              return {
                user_id: user!.id,
                title: event.title,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                location: event.location || '',
                description: `Extracted via OCR fallback with ${event.confidence}% confidence`,
                event_type: 'class',
                source_provider: 'ocr_upload',
                recurrence_rule: event.recurrence || null
              };
            });

            const { error: insertError2 } = await supabase
              .from('events')
              .insert(eventsToInsert);

            if (insertError2) {
              console.error('Error inserting events (fallback):', insertError2);
              throw new Error('Failed to save events to calendar');
            }

            toast({ title: "Schedule uploaded (OCR fallback)", description: `Added ${textResponse.events.length} events to your calendar`, });
            await analyzeUserData();
          } else {
            const msg = textResponse.error || 'No events found in image/text';
            toast({ title: 'No events found', description: msg, variant: 'destructive' });
            setIsAnalyzing(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error processing image:', error);
        toast({
          title: "Processing failed",
          description: "Failed to extract schedule from image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    }
  };

  const triggerFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleImageUpload(file);
      }
    };
    input.click();
  };

  // Empty suggested study blocks for testing
  const suggestedStudyBlocks: any[] = [];

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

      // Create the study session
      const { data: sessionData, error: sessionError } = await supabase
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

      if (sessionError) {
        console.error('Error creating study session:', sessionError);
        toast({
          title: "Error",
          description: "Failed to add study block to calendar",
          variant: "destructive",
        });
        return;
      }

      // Also create a corresponding task
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: studyBlock.title,
          description: studyBlock.description,
          due_date: endTime.toISOString(),
          priority_score: 2, // Medium priority for study blocks
          completion_status: 'pending',
          source_provider: 'study_block',
          course_name: studyBlock.location // Use location as course context
        })
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        // Don't fail the whole operation, just log the error
        console.log('Study session created but task creation failed');
      }

      toast({
        title: "Study Block Added!",
        description: `${studyBlock.title} has been added to your calendar and tasks`,
      });
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
            <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-white border-0 hover:shadow-lg transition-all px-8">
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
                  <p className="text-2xl font-bold text-foreground">{freeTimeToday}</p>
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
                  <p className="text-2xl font-bold text-foreground">{totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "N/A"}</p>
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
                  <p className="text-2xl font-bold text-foreground">{dueThisWeek}</p>
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
                  <p className="text-2xl font-bold text-foreground">{totalTasks > 0 ? `${completionRate}%` : "N/A"}</p>
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
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-4">
                  <Brain className="h-6 w-6 animate-pulse text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">AI analyzing your schedule...</span>
                </div>
              ) : (aiSchedule && aiSchedule.length > 0) ? (
                aiSchedule.map((event: any) => (
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
                ))
              ) : (
                <div className="flex items-center justify-center py-8 text-center">
                  <div>
                    <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No schedule events yet</p>
                    <p className="text-xs text-muted-foreground">Upload an image to get started</p>
                  </div>
                </div>
              )}
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
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-4">
                  <Brain className="h-6 w-6 animate-pulse text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">AI prioritizing your tasks...</span>
                </div>
              ) : (aiPriorities && aiPriorities.length > 0) ? (
                aiPriorities.map((task: any, index: number) => (
                  <div 
                    key={task.id} 
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md ${
                      task.completed ? 'bg-success/5 border-success/20' : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <div className={`w-2 h-2 rounded-full bg-${task.courseColor || 'primary'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            {task.title}
                          </h3>
                          {task.course && (
                            <Badge variant="outline" className="text-xs">
                              {task.course}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{task.workloadReason || task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Due: {task.dueDate || 'No due date'}</span>
                          <span>Est: {task.estimatedHours || 0}h</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {task.priority || 'medium'}
                      </Badge>
                      {task.completed && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8 text-center">
                  <div>
                    <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No tasks yet</p>
                    <p className="text-xs text-muted-foreground">Upload schedule to get AI prioritization</p>
                  </div>
                </div>
              )}
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
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-8">
                <Brain className="h-8 w-8 animate-pulse text-primary mr-3" />
                <span className="text-muted-foreground">AI optimizing your study blocks...</span>
              </div>
            ) : (aiStudyBlocks && aiStudyBlocks.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiStudyBlocks.map((block: any, index: number) => (
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
            ) : (
              <div className="flex items-center justify-center py-8 text-center">
                <div>
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No study blocks suggested yet</p>
                  <p className="text-xs text-muted-foreground">AI will optimize study times after analyzing your schedule</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};