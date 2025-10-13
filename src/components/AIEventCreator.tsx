import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface AIEventCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
  userId: string;
}

export const AIEventCreator = ({ open, onOpenChange, onEventCreated, userId }: AIEventCreatorProps) => {
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

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
            Describe the event you want to create and AI will generate it for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Event Description</Label>
            <Textarea
              id="description"
              placeholder="E.g., 'Team meeting tomorrow at 2pm for 1 hour to discuss project updates' or 'Study session for Psychology exam next Friday from 3pm to 5pm in the library'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground">
              Include details like title, date, time, duration, and location for best results.
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
            disabled={isProcessing || !description.trim()}
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
