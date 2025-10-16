import { usePromotedPosts } from "@/hooks/usePromotedPosts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pause, Play, X } from "lucide-react";

export const PromotionManagement = () => {
  const { promotedPosts, loading, pausePromotion, resumePromotion, cancelPromotion } = usePromotedPosts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!promotedPosts || promotedPosts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground mb-4">No promotions yet</p>
          <p className="text-sm text-muted-foreground">
            Promote your posts to reach a wider audience
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'completed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {promotedPosts.map((promotion) => (
        <Card key={promotion.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">Promotion Campaign</CardTitle>
                <CardDescription>
                  Budget: ${promotion.promotion_budget} • Duration: {promotion.promotion_duration_days} days
                </CardDescription>
              </div>
              <Badge variant={getStatusBadgeVariant(promotion.status)}>
                {promotion.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-xl font-semibold">{promotion.total_impressions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-xl font-semibold">{promotion.total_clicks}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Engagement</p>
                <p className="text-xl font-semibold">{promotion.total_likes + promotion.total_comments}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
                <p className="text-xl font-semibold">{promotion.engagement_rate.toFixed(2)}%</p>
              </div>
            </div>
            <div className="flex gap-2">
              {promotion.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pausePromotion(promotion.id)}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
              {promotion.status === 'paused' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resumePromotion(promotion.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              {(promotion.status === 'active' || promotion.status === 'paused') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => cancelPromotion(promotion.id)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
