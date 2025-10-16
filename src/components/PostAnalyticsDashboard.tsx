import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const PostAnalyticsDashboard = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Post Analytics
        </CardTitle>
        <CardDescription>
          Detailed analytics for all your posts
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-2">Analytics tracking coming soon</p>
        <p className="text-sm text-muted-foreground text-center">
          Track impressions, engagement, and demographics for all your posts
        </p>
      </CardContent>
    </Card>
  );
};
