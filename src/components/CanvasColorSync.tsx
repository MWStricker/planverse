import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Palette, Download, ExternalLink } from "lucide-react";

export const CanvasColorSync = () => {
  const [icsUrl, setIcsUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSync = async () => {
    if (!icsUrl) {
      toast({
        title: "Error",
        description: "Please enter your Canvas ICS URL",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error", 
        description: "You must be logged in to sync colors",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-canvas-colors', {
        body: {
          icsUrl: icsUrl,
          userId: user.id
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: data.message || "Canvas colors synced successfully!",
      });

      // Clear the input
      setIcsUrl("");
      
    } catch (error) {
      console.error('Error syncing colors:', error);
      toast({
        title: "Error",
        description: "Failed to sync Canvas colors. Please check your URL and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form autoComplete="off" data-form-type="other" onSubmit={(e) => e.preventDefault()}>
      <input type="password" autoComplete="new-password" style={{display:'none', position:'absolute', left:'-9999px'}} />
      <input type="text" autoComplete="off" style={{display:'none', position:'absolute', left:'-9999px'}} />
      <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Sync Canvas Colors
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Import your Canvas course colors to match your schedule exactly
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="icsUrl" className="text-sm font-medium">
            Canvas Calendar Feed URL
          </label>
          <Input
            id="icsUrl"
            type="url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://colostate.instructure.com/feeds/calendars/user_..."
            className="w-full"
            autoComplete="new-password"
            data-form-type="other"
            name="canvas-feed-url-unique"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
          />
          <p className="text-xs text-muted-foreground">
            You can find this URL in your Canvas Calendar → Calendar Feed
          </p>
        </div>

        <Button 
          onClick={handleSync} 
          disabled={loading || !icsUrl}
          className="w-full"
        >
          {loading ? (
            <>
              <Download className="h-4 w-4 mr-2 animate-spin" />
              Syncing Colors...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Sync Canvas Colors
            </>
          )}
        </Button>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            How to find your Canvas Calendar Feed URL:
          </h4>
          <ol className="text-xs text-muted-foreground space-y-1 ml-4">
            <li>1. Go to your Canvas Calendar</li>
            <li>2. Click on "Calendar Feed" in the right sidebar</li>
            <li>3. Copy the provided URL (it should end with .ics)</li>
            <li>4. Paste it above and click "Sync Canvas Colors"</li>
          </ol>
        </div>
      </CardContent>
    </Card>
    </form>
  );
};