import React, { memo, useRef } from 'react';
import { Heart, MessageCircle, School, Users, GraduationCap, Hash, Trash2, MoreVertical, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useIntersectionObserver } from '@/lib/performance';
import { Post } from '@/hooks/useConnect';
import { formatDistanceToNow } from 'date-fns';

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
  
  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // Don't render content until card is visible (lazy rendering)
  if (!hasIntersected) {
    return (
      <Card ref={cardRef} className="h-48 animate-pulse">
        <div className="h-full bg-muted/20" />
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
          {/* Moderation status badge for post owners - only show if flagged/hidden */}
          {isOwner && (post.moderation_status === 'auto_hidden' || post.moderation_status === 'flagged') && (
            <div className="ml-auto">
              {post.moderation_status === 'auto_hidden' && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Hidden from others
                </Badge>
              )}
              {post.moderation_status === 'flagged' && (
                <Badge variant="default" className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  Under review
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Moderation warning for hidden/flagged posts */}
        {isOwner && post.moderation_status === 'auto_hidden' && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm">This post is hidden from other users</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Our AI detected content that may violate community guidelines. 
                  {post.moderation_score && ` (Score: ${post.moderation_score}/100)`}
                </p>
                {post.moderation_flags && Array.isArray(post.moderation_flags) && post.moderation_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.moderation_flags.map((flag: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {isOwner && post.moderation_status === 'flagged' && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-700 text-sm">Under review by moderators</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your post has been flagged for review. It's still visible to others.
                  {post.moderation_score && ` (Score: ${post.moderation_score}/100)`}
                </p>
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
            onClick={() => onImageClick(post.image_url!)}
          />
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(post.id)}
              className={`flex items-center gap-2 transition-colors will-change-transform ${
                post.user_liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'
              }`}
            >
              <Heart className={`h-4 w-4 ${post.user_liked ? 'fill-current' : ''}`} />
              {post.likes_count}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onComment(post)}
              className="flex items-center gap-2 text-muted-foreground transition-colors will-change-transform"
            >
              <MessageCircle className="h-4 w-4" />
              {post.comments_count}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg z-50">
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
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
                </DropdownMenuContent>
              </DropdownMenu>
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
