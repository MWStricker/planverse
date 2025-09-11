import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, Plus, User, School } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useConnect, Post, Comment } from '@/hooks/useConnect';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

export const Connect = () => {
  const { user } = useAuth();
  const { posts, loading, createPost, toggleLike, fetchComments, addComment } = useConnect();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    
    const success = await createPost(newPostContent);
    if (success) {
      setNewPostContent('');
      setIsPostDialogOpen(false);
    }
  };

  const handleLike = async (postId: string) => {
    await toggleLike(postId);
  };

  const handleViewComments = async (post: Post) => {
    setSelectedPost(post);
    const postComments = await fetchComments(post.id);
    setComments(postComments);
    setCommentsDialogOpen(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPost) return;
    
    const success = await addComment(selectedPost.id, newComment);
    if (success) {
      setNewComment('');
      // Refresh comments
      const updatedComments = await fetchComments(selectedPost.id);
      setComments(updatedComments);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Student Connect</h1>
        <Dialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="What's on your mind?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[120px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPostDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePost} disabled={!newPostContent.trim()}>
                  Post
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="animate-fade-in">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={post.profiles.avatar_url} />
                    <AvatarFallback>
                      {post.profiles.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        {post.profiles.display_name}
                      </h3>
                      {post.profiles.school && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <School className="h-3 w-3" />
                          {post.profiles.school}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {post.profiles.major && (
                        <span>{post.profiles.major}</span>
                      )}
                      <span>•</span>
                      <span>{formatTimeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap mb-4">{post.content}</p>
                
                {post.image_url && (
                  <img 
                    src={post.image_url} 
                    alt="Post image" 
                    className="w-full rounded-lg mb-4 max-h-96 object-cover"
                  />
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-2 ${
                        post.user_liked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${post.user_liked ? 'fill-current' : ''}`} />
                      {post.likes_count}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewComments(post)}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {post.comments_count}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          
          {selectedPost && (
            <div className="space-y-4">
              {/* Original Post */}
              <div className="border-b pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedPost.profiles.avatar_url} />
                    <AvatarFallback>
                      {selectedPost.profiles.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold">{selectedPost.profiles.display_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAgo(selectedPost.created_at)}
                    </p>
                  </div>
                </div>
                <p className="text-foreground">{selectedPost.content}</p>
              </div>

              {/* Comments */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.profiles.avatar_url} />
                        <AvatarFallback>
                          {comment.profiles.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {comment.profiles.display_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment */}
              {user && (
                <div className="flex items-start gap-3 pt-4 border-t">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      Comment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};