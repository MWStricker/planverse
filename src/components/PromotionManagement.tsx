import { usePromotedPosts } from "@/hooks/usePromotedPosts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pause, Play, X, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { PromotePostDialog } from "./PromotePostDialog";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  is_promoted: boolean;
}

export const PromotionManagement = () => {
  const { user } = useAuth();
  const { promotedPosts, loading, pausePromotion, resumePromotion, cancelPromotion } = usePromotedPosts();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchAllPosts = async () => {
      if (!user) return;
      
      setLoadingPosts(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id, content, image_url, created_at, is_promoted')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAllPosts(data || []);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoadingPosts(false);
      }
    };

    if (user) {
      fetchAllPosts();
    }
  }, [user]);

  const handlePromoteClick = (post: Post) => {
    setSelectedPost(post);
    setPromoteDialogOpen(true);
  };

  if (loading || loadingPosts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nonPromotedPosts = allPosts.filter(p => !p.is_promoted);

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
    <div className="space-y-6">
      {/* Active Promotions Section */}
      {promotedPosts && promotedPosts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Active Promotions ({promotedPosts.length})</h3>
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
      )}

      {/* Your Posts Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Posts ({nonPromotedPosts.length})</h3>
        {nonPromotedPosts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-48">
              <p className="text-muted-foreground mb-2">No posts available to promote</p>
              <p className="text-sm text-muted-foreground">
                Create posts in the Connect tab first
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {nonPromotedPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {post.image_url && (
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-muted">
                        <img 
                          src={post.image_url} 
                          alt="Post" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="text-sm line-clamp-2">{post.content}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handlePromoteClick(post)}
                        className="gap-1"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Promote
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Promote Post Dialog */}
      {selectedPost && (
        <PromotePostDialog
          open={promoteDialogOpen}
          onOpenChange={setPromoteDialogOpen}
          post={selectedPost}
        />
      )}
    </div>
  );
};
