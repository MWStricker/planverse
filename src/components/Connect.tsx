import React, { useState, useMemo, memo, useRef } from 'react';
import { PostCard } from './PostCard';
import { Heart, MessageCircle, Share2, Plus, User, School, Trash2, MoreVertical, Users, Mail, Hash, Globe, GraduationCap, Calendar, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConnect, Post, Comment, PublicProfile } from '@/hooks/useConnect';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PeopleDirectory } from './PeopleDirectory';
import { MessagingCenter } from './MessagingCenter';
import { CreatePostDialog } from './CreatePostDialog';
import { PostFilters } from './PostFilters';
import { PublicProfile as PublicProfileComponent } from './PublicProfile';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';

interface ConnectProps {
  onNavigateToAnalytics?: () => void;
}

export const Connect = ({ onNavigateToAnalytics }: ConnectProps = {}) => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { posts, loading, createPost, deletePost, toggleLike, fetchComments, addComment, fetchPublicProfile } = useConnect();
  const { sendFriendRequest, checkFriendshipStatus } = useFriends();
  const { toast } = useToast();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostDialogOpen, setIsPostDialogOpen] = useState(false);
  const [localPosts, setLocalPosts] = useState(posts);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(() => 
    localStorage.getItem('connect-selected-chat') || null
  );
  const [activeTab, setActiveTab] = useState(() => 
    localStorage.getItem('connect-active-tab') || 'feed'
  );
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
  const [maximizedPostOpen, setMaximizedPostOpen] = useState(false);
  const [maximizedPost, setMaximizedPost] = useState<Post | null>(null);

  // Persist active tab to localStorage
  React.useEffect(() => {
    localStorage.setItem('connect-active-tab', activeTab);
  }, [activeTab]);

  // Persist selected chat to localStorage
  React.useEffect(() => {
    if (selectedChatUserId) {
      localStorage.setItem('connect-selected-chat', selectedChatUserId);
    } else {
      localStorage.removeItem('connect-selected-chat');
    }
  }, [selectedChatUserId]);

  // Handle hash-based navigation from notifications
  React.useEffect(() => {
    const handleHashNavigation = () => {
      const hash = window.location.hash.slice(1);
      
      if (hash.startsWith('message:')) {
        const conversationId = hash.split(':')[1];
        setActiveTab('messages');
        setSelectedChatUserId(conversationId);
      } else if (hash.startsWith('post:')) {
        const postId = hash.split(':')[1];
        setActiveTab('feed');
        // Scroll to post after render
        setTimeout(() => {
          const postElement = document.getElementById(`post-${postId}`);
          postElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else if (hash.startsWith('tab:')) {
        const tab = hash.split(':')[1];
        setActiveTab(tab);
      }
      
      // Clear hash after navigation
      window.history.replaceState(null, '', window.location.pathname);
    };

    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);
    return () => window.removeEventListener('hashchange', handleHashNavigation);
  }, []);

  // Sync posts to local state
  React.useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // Real-time listeners for posts and likes (OPTIMIZED: Stable channel refs)
  React.useEffect(() => {
    if (!user) return;

    console.log('🔌 Setting up real-time channels for user:', user.id);

    const postsChannel = supabase.channel(`posts-realtime-${user.id}`, {
      config: { broadcast: { ack: false } }
    });

    const likesChannel = supabase.channel(`post-likes-realtime-${user.id}`, {
      config: { broadcast: { ack: false } }
    });

    // Posts Channel - Listen for new posts and deletions
    postsChannel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload: any) => {
          console.log('📝 Real-time: New post detected', payload);
          const [
            { data: newPostData },
            { data: profileData }
          ] = await Promise.all([
            supabase.from('posts').select('*').eq('id', payload.new.id).single(),
            supabase.from('profiles').select('user_id, display_name, avatar_url, school, major').eq('user_id', payload.new.user_id).single()
          ]);

          if (!newPostData || !profileData) return;

          const { data: likeData } = await supabase
            .from('post_likes')
            .select('id')
            .eq('post_id', newPostData.id)
            .eq('user_id', user.id)
            .maybeSingle();

          const formattedPost: Post = {
            ...newPostData,
            profiles: {
              display_name: profileData.display_name,
              avatar_url: profileData.avatar_url || undefined,
              school: profileData.school || undefined,
              major: profileData.major || undefined
            },
            user_liked: !!likeData
          };

          setLocalPosts(prev => {
            if (prev.some(p => p.id === formattedPost.id)) return prev;
            return [formattedPost, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload: any) => {
          console.log('🗑️ Real-time: Post deleted', payload);
          setLocalPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        console.log('📡 Posts channel status:', status);
      });

    // Likes Channel - Listen for like/unlike events
    likesChannel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_likes' },
        (payload: any) => {
          console.log('❤️ Real-time: Like added', payload);
          const { post_id, user_id } = payload.new;
          setLocalPosts(prev => prev.map(post => {
            if (post.id === post_id) {
              return {
                ...post,
                likes_count: (post.likes_count || 0) + 1,
                user_liked: user_id === user.id ? true : post.user_liked
              };
            }
            return post;
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_likes' },
        (payload: any) => {
          console.log('💔 Real-time: Like removed', payload);
          const { post_id, user_id } = payload.old;
          setLocalPosts(prev => prev.map(post => {
            if (post.id === post_id) {
              return {
                ...post,
                likes_count: Math.max((post.likes_count || 0) - 1, 0),
                user_liked: user_id === user.id ? false : post.user_liked
              };
            }
            return post;
          }));
        }
      )
      .subscribe((status) => {
        console.log('💗 Likes channel status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up real-time channels');
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [user]);

  const handleCreatePost = async (postData: {
    content: string;
    imageUrl?: string;
    targetMajor?: string;
    targetCommunity?: string;
    postType: string;
    visibility: string;
    tags: string[];
  }) => {
    // Optimistic update (Phase 1)
    const tempPost: any = {
      id: `temp-${Date.now()}`,
      content: postData.content,
      image_url: postData.imageUrl,
      user_id: user!.id,
      profiles: {
        user_id: user!.id,
        display_name: user!.email?.split('@')[0] || 'You',
        avatar_url: null,
        school: null,
        major: null
      },
      likes_count: 0,
      comments_count: 0,
      created_at: new Date().toISOString(),
      moderation_status: 'pending',
      post_type: postData.postType,
      visibility: postData.visibility,
      tags: postData.tags,
      user_liked: false
    };
    
    setLocalPosts(prev => [tempPost, ...prev]);
    setIsPostDialogOpen(false);
    
    const success = await createPost(postData.content, postData.imageUrl);
    
    if (!success) {
      // Remove temp post on failure
      setLocalPosts(prev => prev.filter(p => p.id !== tempPost.id));
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    }
    
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

  const handleMaximizePost = (post: Post) => {
    setMaximizedPost(post);
    setMaximizedPostOpen(true);
  };

  // Memoize filtered posts to prevent unnecessary recalculations
  const filteredPosts = useMemo(() => {
    return localPosts.filter(post => {
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
  }, [localPosts, postFilters]);

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
        
        {/* Analytics Button - Only for Professional Accounts */}
        {profile?.account_type?.startsWith('professional_') && onNavigateToAnalytics && (
          <Button 
            variant="outline"
            className="flex items-center gap-2"
            onClick={onNavigateToAnalytics}
          >
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">View Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </Button>
        )}
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
                    id={`post-${post.id}`}
                    post={post}
                    isOwner={user?.id === post.user_id}
                    onLike={handleLike}
                    onComment={handleViewComments}
                    onDelete={deletePost}
                    onImageClick={handleOpenImage}
                    onProfileClick={handleViewProfile}
                    onMaximize={handleMaximizePost}
                  />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          <PeopleDirectory onStartChat={(userId) => {
            setSelectedChatUserId(userId);
            setActiveTab('messages');
          }} />
        </TabsContent>

        <TabsContent value="messages" className="mt-6">
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
                      id="comment-input"
                      name="comment-input"
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                      autoComplete="off"
                      data-form-type="other"
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

      {/* Maximized Post Dialog */}
      <Dialog open={maximizedPostOpen} onOpenChange={setMaximizedPostOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          
          {maximizedPost && (
            <div className="space-y-4">
              {/* Author Info */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <Avatar 
                  className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    handleViewProfile(maximizedPost.user_id);
                    setMaximizedPostOpen(false);
                  }}
                >
                  <AvatarImage src={maximizedPost.profiles.avatar_url} />
                  <AvatarFallback>
                    {maximizedPost.profiles.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 
                      className="font-semibold text-lg cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        handleViewProfile(maximizedPost.user_id);
                        setMaximizedPostOpen(false);
                      }}
                    >
                      {maximizedPost.profiles.display_name}
                    </h3>
                    {maximizedPost.profiles.school && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <School className="h-3 w-3" />
                        {maximizedPost.profiles.school}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {maximizedPost.profiles.major && (
                      <span>{maximizedPost.profiles.major}</span>
                    )}
                    <span>•</span>
                    <span>{formatTimeAgo(maximizedPost.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Post Type and Visibility Badges */}
              <div className="flex flex-wrap gap-2">
                {(maximizedPost.post_type || 'general') !== 'general' && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {(maximizedPost.post_type || 'general') === 'academic' && <GraduationCap className="h-3 w-3" />}
                    {(maximizedPost.post_type || 'general') === 'social' && <Users className="h-3 w-3" />}
                    {(maximizedPost.post_type || 'general') === 'announcement' && <Hash className="h-3 w-3" />}
                    {(maximizedPost.post_type || 'general') === 'question' && <Hash className="h-3 w-3" />}
                    {(maximizedPost.post_type || 'general') === 'study-group' && <Users className="h-3 w-3" />}
                    {(maximizedPost.post_type || 'general').charAt(0).toUpperCase() + (maximizedPost.post_type || 'general').slice(1)}
                  </Badge>
                )}
                {(maximizedPost.visibility || 'public') !== 'public' && (
                  <Badge variant="outline">
                    {(maximizedPost.visibility || 'public') === 'school-only' && 'School Only'}
                    {(maximizedPost.visibility || 'public') === 'major-only' && 'Major Only'}
                    {(maximizedPost.visibility || 'public') === 'friends-only' && 'Friends Only'}
                  </Badge>
                )}
                {maximizedPost.target_major && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {maximizedPost.target_major}
                  </Badge>
                )}
                {maximizedPost.target_community && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <School className="h-3 w-3" />
                    {maximizedPost.target_community}
                  </Badge>
                )}
                {(maximizedPost.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>

              {/* Post Content */}
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-wrap text-base leading-relaxed">
                  {maximizedPost.content}
                </p>
              </div>

              {/* Post Image */}
              {maximizedPost.image_url && (
                <div className="rounded-lg overflow-hidden border">
                  <img 
                    src={maximizedPost.image_url} 
                    alt="Post image" 
                    className="w-full cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      handleOpenImage(maximizedPost.image_url!);
                      setMaximizedPostOpen(false);
                    }}
                  />
                </div>
              )}

              {/* Engagement Stats and Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="default"
                    onClick={async () => {
                      await handleLike(maximizedPost.id);
                      setMaximizedPost({
                        ...maximizedPost,
                        user_liked: !maximizedPost.user_liked,
                        likes_count: maximizedPost.user_liked 
                          ? maximizedPost.likes_count - 1 
                          : maximizedPost.likes_count + 1
                      });
                    }}
                    className={`flex items-center gap-2 ${
                      maximizedPost.user_liked ? 'text-red-500 hover:text-red-600' : ''
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${maximizedPost.user_liked ? 'fill-current' : ''}`} />
                    <span className="font-medium">{maximizedPost.likes_count}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="default"
                    onClick={() => {
                      setMaximizedPostOpen(false);
                      handleViewComments(maximizedPost);
                    }}
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="font-medium">{maximizedPost.comments_count}</span>
                  </Button>
                </div>
              </div>

              {/* Quick Comment Section */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMaximizedPostOpen(false);
                    handleViewComments(maximizedPost);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  View All Comments
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};