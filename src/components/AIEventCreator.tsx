import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Mic, MicOff } from "lucide-react";

interface AIEventCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
  userId: string;
}

export const AIEventCreator = ({ open, onOpenChange, onEventCreated, userId }: AIEventCreatorProps) => {
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording",
        description: "Speak your event details...",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to process audio');
        }

        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        if (data?.text) {
          setDescription(prev => prev ? `${prev} ${data.text}` : data.text);
          toast({
            title: "Transcribed",
            description: "Your speech has been converted to text",
          });
        }
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast({
        title: "Error",
        description: "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe the event you want to create.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Call the AI edge function to generate event details
      const { data, error } = await supabase.functions.invoke('ai-create-event', {
        body: { description, userId }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Event created!",
        description: `"${data.event.title}" has been added to your calendar.`,
      });

      setDescription("");
      onOpenChange(false);
      onEventCreated();
    } catch (error: any) {
      console.error('Error creating AI event:', error);
      toast({
        title: "Failed to create event",
        description: error.message || "An error occurred while creating the event.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Event Creator
          </DialogTitle>
          <DialogDescription>
            Describe the event you want to create using text or voice dictation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Event Description</Label>
            
            <Button
              type="button"
              size="lg"
              variant={isRecording ? "destructive" : "outline"}
              className={`w-full ${isRecording ? 'animate-pulse' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || isTranscribing}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transcribing...
                </>
              ) : isRecording ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Start Voice Recording
                </>
              )}
            </Button>

            {isRecording && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md animate-pulse">
                <div className="h-3 w-3 bg-red-500 rounded-full" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  Recording... Speak your event details clearly
                </span>
              </div>
            )}
            
            <Textarea
              id="description"
              placeholder="Describe your event... (e.g., 'Math exam tomorrow at 2pm')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              disabled={isProcessing || isRecording || isTranscribing}
            />
            
            <p className="text-sm text-muted-foreground">
              {isRecording 
                ? "🎤 Listening... Speak clearly" 
                : isTranscribing 
                ? "✍️ Converting speech to text..." 
                : "Type or use voice recording to describe your event"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateEvent}
            disabled={isProcessing || !description.trim() || isRecording || isTranscribing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Event
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
