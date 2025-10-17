import React, { memo, useRef, useState, useEffect } from 'react';
import { Heart, MessageCircle, School, Users, GraduationCap, Hash, Trash2, MoreVertical, ShieldAlert, AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FloatingActionPanelRoot, FloatingActionPanelTrigger, FloatingActionPanelContent, FloatingActionPanelButton } from '@/components/ui/floating-action-panel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useIntersectionObserver } from '@/lib/performance';
import { Post } from '@/hooks/useConnect';
import { formatDistanceToNow } from 'date-fns';
import { hapticSelection } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useBlockUser } from '@/hooks/useBlockUser';

interface PostCardProps {
  post: Post;
  isOwner: boolean;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onDelete: (postId: string) => void;
  onImageClick: (imageUrl: string) => void;
  onProfileClick?: (userId: string) => void;
}

// Memoized PostCard for better performance
export const PostCard = memo(({ post, isOwner, onLike, onComment, onDelete, onImageClick, onProfileClick }: PostCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(cardRef, { rootMargin: '100px' });
  const { user } = useAuth();
  const { profile } = useProfile();
  const { blockUser } = useBlockUser();
  const [hasTrackedView, setHasTrackedView] = useState(false);
  
  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const [optimisticLiked, setOptimisticLiked] = React.useState(post.user_liked);
  const [optimisticLikesCount, setOptimisticLikesCount] = React.useState(post.likes_count);

  // Sync with props
  React.useEffect(() => {
    setOptimisticLiked(post.user_liked);
    setOptimisticLikesCount(post.likes_count);
  }, [post.user_liked, post.likes_count]);

  // Track view when post is visible
  useEffect(() => {
    if (!hasIntersected || !post.id || hasTrackedView || !user?.id) return;
    
    const trackView = async () => {
      // Wait 2 seconds before tracking (ensures user actually viewed)
      const timer = setTimeout(async () => {
        try {
          await supabase.functions.invoke('track-post-view', {
            body: {
              postId: post.id,
              viewerId: user.id,
              viewerSchool: profile?.school || null,
              viewerMajor: profile?.major || null
            }
          });
          setHasTrackedView(true);
          console.log(`Tracked view for post ${post.id}`);
        } catch (error) {
          console.error('Error tracking post view:', error);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    };
    
    trackView();
  }, [hasIntersected, post.id, user?.id, profile?.school, profile?.major, hasTrackedView]);

  const trackEngagement = async (type: 'like' | 'comment' | 'share' | 'click') => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.rpc('upsert_daily_analytics', {
        p_post_id: post.id,
        p_date: today,
        p_increment_impressions: 0,
        p_increment_clicks: type === 'click' ? 1 : 0,
        p_increment_likes: type === 'like' ? 1 : 0,
        p_increment_comments: type === 'comment' ? 1 : 0,
        p_increment_shares: type === 'share' ? 1 : 0
      });
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  };

  const handleLikeClick = async () => {
    // Optimistic update with haptic feedback (Phase 1 & 3)
    const wasLiked = optimisticLiked;
    setOptimisticLiked(!wasLiked);
    setOptimisticLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    hapticSelection();

    try {
      await onLike(post.id);
      
      // Track like engagement
      if (!wasLiked) {
        await trackEngagement('like');
      }
    } catch (error) {
      // Revert on failure
      setOptimisticLiked(wasLiked);
      setOptimisticLikesCount(post.likes_count);
    }
  };
  
  const handleCommentClick = async () => {
    onComment(post);
    await trackEngagement('comment');
  };
  
  const handleImageClick = async () => {
    onImageClick(post.image_url!);
    await trackEngagement('click');
  };

  // Skeleton loading (Phase 2)
  if (!hasIntersected) {
    return (
      <Card ref={cardRef} className="animate-pulse">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/4 bg-muted rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={cardRef} className="animate-fade-in will-change-transform">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar 
            className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onProfileClick?.(post.user_id)}
          >
            <AvatarImage src={post.profiles.avatar_url} loading="lazy" />
            <AvatarFallback>
              {post.profiles.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 
                className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => onProfileClick?.(post.user_id)}
              >
                {post.profiles.display_name}
              </h3>
              {post.profiles.school && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <School className="h-3 w-3" />
                  {post.profiles.school}
                </Badge>
              )}
              {(post.post_type || 'general') !== 'general' && (
                <Badge variant="outline" className="flex items-center gap-1">
                  {(post.post_type || 'general') === 'academic' && <GraduationCap className="h-3 w-3" />}
                  {(post.post_type || 'general') === 'social' && <Users className="h-3 w-3" />}
                  {(post.post_type || 'general') === 'announcement' && <Hash className="h-3 w-3" />}
                  {(post.post_type || 'general') === 'question' && <Hash className="h-3 w-3" />}
                  {(post.post_type || 'general') === 'study-group' && <Users className="h-3 w-3" />}
                  {(post.post_type || 'general').charAt(0).toUpperCase() + (post.post_type || 'general').slice(1)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {post.profiles.major && (
                <span>{post.profiles.major}</span>
              )}
              <span>•</span>
              <span>{formatTimeAgo(post.created_at)}</span>
              {(post.visibility || 'public') !== 'public' && (
                <>
                  <span>•</span>
                  <Badge variant="outline" className="text-xs">
                    {(post.visibility || 'public') === 'school-only' && 'School Only'}
                    {(post.visibility || 'public') === 'major-only' && 'Major Only'}
                    {(post.visibility || 'public') === 'friends-only' && 'Friends Only'}
                  </Badge>
                </>
              )}
            </div>
          </div>
          {/* Moderation status badge for post owners - only show if hidden */}
          {isOwner && post.moderation_status === 'auto_hidden' && (
            <div className="ml-auto">
              <Badge variant="destructive" className="flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                Hidden from others
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Moderation warning for hidden posts */}
        {isOwner && post.moderation_status === 'auto_hidden' && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm mb-2">The post is hidden from other users.</p>
                {post.moderation_flags && Array.isArray(post.moderation_flags) && post.moderation_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.moderation_flags.map((flag: string, i: number) => (
                      <Badge key={i} variant="destructive" className="text-xs">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Post metadata */}
        <div className="flex flex-wrap gap-2 mb-3">
          {post.target_major && (
            <Badge variant="outline" className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              {post.target_major}
            </Badge>
          )}
          {post.target_community && (
            <Badge variant="outline" className="flex items-center gap-1">
              <School className="h-3 w-3" />
              {post.target_community}
            </Badge>
          )}
          {(post.tags || []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
        
        <p className="text-foreground whitespace-pre-wrap mb-4">{post.content}</p>
        
        {post.image_url && (
          <img 
            src={post.image_url} 
            alt="Post image" 
            loading="lazy"
            decoding="async"
            className="w-full rounded-lg mb-4 max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity will-change-transform"
            onClick={handleImageClick}
          />
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              className={`flex items-center gap-2 transition-all will-change-transform ${
                optimisticLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'
              }`}
            >
              <Heart className={`h-4 w-4 transition-transform ${optimisticLiked ? 'fill-current scale-110' : ''}`} />
              {optimisticLikesCount}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCommentClick}
              className="flex items-center gap-2 text-muted-foreground transition-colors will-change-transform"
            >
              <MessageCircle className="h-4 w-4" />
              {post.comments_count}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <FloatingActionPanelRoot>
                {({ closePanel }) => (
                  <>
                    <FloatingActionPanelTrigger 
                      title="Post Actions" 
                      mode="actions"
                      className="h-8 w-8 p-0 hover:bg-accent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </FloatingActionPanelTrigger>
                    
                    <FloatingActionPanelContent>
                      <div className="p-2 space-y-1">
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <FloatingActionPanelButton
                              onClick={() => {
                                setDeleteDialogOpen(true);
                                closePanel();
                              }}
                              className="text-destructive hover:text-destructive w-full"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Post
                            </FloatingActionPanelButton>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Post</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this post? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  onDelete(post.id);
                                  setDeleteDialogOpen(false);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </FloatingActionPanelContent>
                  </>
                )}
              </FloatingActionPanelRoot>
            )}
            {!isOwner && (
              <FloatingActionPanelRoot>
                {({ closePanel }) => (
                  <>
                    <FloatingActionPanelTrigger 
                      title="More Actions" 
                      mode="actions"
                      className="h-8 w-8 p-0 hover:bg-accent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </FloatingActionPanelTrigger>
                    
                    <FloatingActionPanelContent>
                      <div className="p-2">
                        <FloatingActionPanelButton
                          onClick={async () => {
                            await blockUser(post.user_id);
                            closePanel();
                            window.location.reload(); // Refresh to hide blocked user's posts
                          }}
                          className="text-destructive hover:text-destructive w-full"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Block User
                        </FloatingActionPanelButton>
                      </div>
                    </FloatingActionPanelContent>
                  </>
                )}
              </FloatingActionPanelRoot>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo to prevent unnecessary re-renders
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.likes_count === nextProps.post.likes_count &&
    prevProps.post.comments_count === nextProps.post.comments_count &&
    prevProps.post.user_liked === nextProps.post.user_liked &&
    prevProps.isOwner === nextProps.isOwner
  );
});

PostCard.displayName = 'PostCard';
