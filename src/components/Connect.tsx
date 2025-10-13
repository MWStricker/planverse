import React, { useState, useMemo, memo, useRef } from 'react';
import { useIntersectionObserver } from '@/lib/performance';
import { PostCard } from './PostCard';
import { Heart, MessageCircle, Share2, Plus, User, School, Trash2, MoreVertical, Users, Mail, Hash, Globe, GraduationCap, Calendar, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConnect, Post, Comment, PublicProfile } from '@/hooks/useConnect';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useToast } from '@/hooks/use-toast';
import { PeopleDirectory } from './PeopleDirectory';
import { MessagingCenter } from './MessagingCenter';
import { CreatePostDialog } from './CreatePostDialog';
import { PostFilters } from './PostFilters';
import { PublicProfile as PublicProfileComponent } from './PublicProfile';
import { formatDistanceToNow } from 'date-fns';

export const Connect = () => {
  const { user } = useAuth();
  const { posts, loading, createPost, deletePost, toggleLike, fetchComments, addComment, fetchPublicProfile } = useConnect();
  const { sendFriendRequest, checkFriendshipStatus } = useFriends();
  const { toast } = useToast();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('feed');
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [postFilters, setPostFilters] = useState({
    search: '',
    postType: '',
    major: '',
    school: '',
    sortBy: 'newest'
  });
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<PublicProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleCreatePost = async (postData: {
    content: string;
    imageUrl?: string;
    targetMajor?: string;
    targetCommunity?: string;
    postType: string;
    visibility: string;
    tags: string[];
  }) => {
    // Create a combined call since createPost expects different parameters
    const success = await createPost(postData.content, postData.imageUrl);
    return success;
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

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    
    const success = await deletePost(postToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    }
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 25, 50));
  };

  const handleOpenImage = (imageUrl: string) => {
    setZoomedImage(imageUrl);
    setImageZoom(100);
    setIsFullscreen(false);
    setImageZoomOpen(true);
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const handleViewProfile = async (userId: string) => {
    const profile = await fetchPublicProfile(userId);
    if (profile) {
      setSelectedPublicProfile(profile);
      setProfileDialogOpen(true);
    } else {
      toast({
        title: "Profile Not Found",
        description: "This user's profile is not public or doesn't exist.",
        variant: "destructive",
      });
    }
  };

  // Memoize filtered posts to prevent unnecessary recalculations
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      // Search filter
      if (postFilters.search && !post.content.toLowerCase().includes(postFilters.search.toLowerCase()) &&
          !post.profiles.display_name.toLowerCase().includes(postFilters.search.toLowerCase())) {
        return false;
      }

      // Post type filter
      if (postFilters.postType && (post.post_type || 'general') !== postFilters.postType) {
        return false;
      }

      // Major filter
      if (postFilters.major && post.profiles.major !== postFilters.major) {
        return false;
      }

      // School filter  
      if (postFilters.school && post.profiles.school !== postFilters.school) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      switch (postFilters.sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most-liked':
          return (b.likes_count || 0) - (a.likes_count || 0);
        case 'most-commented':
          return (b.comments_count || 0) - (a.comments_count || 0);
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [posts, postFilters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Student Connect</h1>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="people" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          {/* Post Filters */}
          <PostFilters onFilterChange={setPostFilters} />
          
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Latest Posts</h2>
            <CreatePostDialog
              open={isPostDialogOpen}
              onOpenChange={setIsPostDialogOpen}
              onCreatePost={handleCreatePost}
            />
            <Button 
              className="flex items-center gap-2"
              onClick={() => setIsPostDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          </div>

          {/* Posts Feed */}
          <div className="max-w-2xl mx-auto space-y-4">
            {filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {postFilters.search || postFilters.postType || postFilters.major || postFilters.school
                      ? 'No posts match your filters.'
                      : 'No posts yet. Be the first to share something!'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isOwner={user?.id === post.user_id}
                  onLike={handleLike}
                  onComment={handleViewComments}
                  onDelete={deletePost}
                  onImageClick={handleOpenImage}
                  onProfileClick={handleViewProfile}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="people">
          <PeopleDirectory onStartChat={(userId) => {
            setSelectedChatUserId(userId);
            setActiveTab('messages');
          }} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagingCenter 
            selectedUserId={selectedChatUserId} 
            onClose={() => setSelectedChatUserId(null)}
          />
        </TabsContent>
      </Tabs>

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
                      <Avatar 
                        className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleViewProfile(comment.user_id)}
                      >
                        <AvatarImage src={comment.profiles.avatar_url} />
                        <AvatarFallback>
                          {comment.profiles.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span 
                              className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleViewProfile(comment.user_id)}
                            >
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
                      autoComplete="off"
                      data-form-type="other"
                      name="comment-input"
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

      {/* Image Zoom Dialog */}
      <Dialog open={imageZoomOpen} onOpenChange={(open) => {
        setImageZoomOpen(open);
        if (!open) {
          setImageZoom(100);
          setIsFullscreen(false);
        }
      }}>
        <DialogContent hideCloseButton className={`${isFullscreen ? 'max-w-[98vw] h-[98vh]' : 'max-w-5xl h-[85vh]'} p-0 transition-all duration-300`}>
          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 z-10 flex gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 shadow-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={imageZoom <= 50}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={imageZoom >= 300}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          {/* Zoom Level Indicator */}
          <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1 shadow-lg">
            <span className="text-sm font-medium">{imageZoom}%</span>
          </div>

          {/* Scrollable Image Container */}
          <div className="relative w-full h-full overflow-auto bg-muted/30">
            <div className="min-h-full flex items-center justify-center p-4">
              {zoomedImage && (
                <img 
                  src={zoomedImage} 
                  alt="Zoomed post image" 
                  className="transition-transform duration-200 ease-out"
                  style={{ 
                    transform: `scale(${imageZoom / 100})`,
                    maxWidth: imageZoom <= 100 ? '100%' : 'none',
                    height: 'auto'
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPublicProfile && (
            <PublicProfileComponent
              profile={selectedPublicProfile}
              onSendMessage={() => {
                setProfileDialogOpen(false);
                setSelectedChatUserId(selectedPublicProfile.user_id!);
                // Switch to messages tab
                const messagesButton = document.querySelector('[value="messages"]') as HTMLButtonElement;
                messagesButton?.click();
              }}
              onAddFriend={async () => {
                if (!selectedPublicProfile.user_id) return;
                const status = await checkFriendshipStatus(selectedPublicProfile.user_id);
                if (status === 'none') {
                  const success = await sendFriendRequest(selectedPublicProfile.user_id);
                  if (success) {
                    toast({
                      title: "Friend Request Sent",
                      description: `Friend request sent to ${selectedPublicProfile.display_name}!`,
                    });
                    setProfileDialogOpen(false);
                  }
                } else if (status === 'friends') {
                  toast({ title: "Already Friends", description: "You're already friends with this user!" });
                } else if (status === 'sent') {
                  toast({ title: "Request Pending", description: "You already sent a friend request." });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};