import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { useModeration } from '@/hooks/useModeration';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  target_major?: string;
  target_community?: string;
  post_type: string;
  visibility: string;
  tags: string[];
  moderation_status?: string;
  moderation_score?: number;
  moderation_flags?: any;
  profiles: {
    display_name: string;
    avatar_url?: string;
    school?: string;
    major?: string;
  };
  user_liked?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url?: string;
  };
}

export interface PublicProfile {
  id?: string;
  user_id?: string;
  display_name: string;
  avatar_url?: string;
  school?: string;
  major?: string;
  bio?: string;
  graduation_year?: number;
  is_public?: boolean;
}

export const useConnect = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { moderateContent } = useModeration();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch posts with profile information
  const fetchPosts = async () => {
    setLoading(true);
    try {
      // First fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Then fetch profiles for these posts
      const userIds = postsData?.map(post => post.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, school, major')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(profilesData?.map(profile => [profile.user_id, profile]) || []);

      // Check which posts current user has liked
      let likedPostIds = new Set<string>();
      if (user) {
        const postIds = postsData?.map(post => post.id) || [];
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);

        likedPostIds = new Set(likes?.map(like => like.post_id) || []);
      }

      // Combine posts with profiles
      const formattedPosts = postsData?.map(post => {
        const profile = profilesMap.get(post.user_id);
        return {
          ...post,
          user_liked: likedPostIds.has(post.id),
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          profiles: {
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url,
            school: profile?.school,
            major: profile?.major,
          }
        };
      }) || [];

      setPosts(formattedPosts as Post[]);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create a new post
  const createPost = async (content: string, imageUrl?: string) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content,
          image_url: imageUrl,
          post_type: 'general',
          visibility: 'public',
          tags: [],
          target_major: null,
          target_community: null
        })
        .select()
        .single();

      if (error) throw error;

      // Moderate the post content
      if (data?.id) {
        await moderateContent(content, 'post', data.id);
      }

      toast({
        title: "Success",
        description: "Post created successfully!",
      });

      await fetchPosts(); // Refresh posts
      return true;
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
      return false;
    }
  };

  // Toggle like on a post
  const toggleLike = async (postId: string) => {
    if (!user) return;

    try {
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      const isUnlike = !!existingLike;

      // Optimistically update the UI
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            user_liked: !isUnlike,
            likes_count: isUnlike ? post.likes_count - 1 : post.likes_count + 1
          };
        }
        return post;
      }));

      if (isUnlike) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        // Update likes count
        await supabase.rpc('decrement_likes_count', { post_id: postId });
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        // Update likes count
        await supabase.rpc('increment_likes_count', { post_id: postId });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error
      await fetchPosts();
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId: string): Promise<Comment[]> => {
    try {
      // First fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Then fetch profiles for these comments
      const userIds = commentsData?.map(comment => comment.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(profilesData?.map(profile => [profile.user_id, profile]) || []);

      // Combine comments with profiles
      const formattedComments = commentsData?.map(comment => {
        const profile = profilesMap.get(comment.user_id);
        return {
          ...comment,
          profiles: {
            display_name: profile?.display_name || 'Unknown User',
            avatar_url: profile?.avatar_url,
          }
        };
      }) || [];

      return formattedComments as Comment[];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  };

  // Add a comment to a post
  const addComment = async (postId: string, content: string) => {
    if (!user) return false;

    try {
      // Optimistically update comment count
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments_count: post.comments_count + 1
          };
        }
        return post;
      }));

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Moderate the comment content
      if (data?.id) {
        await moderateContent(content, 'comment', data.id);
      }

      // Update comments count
      await supabase.rpc('increment_comments_count', { post_id: postId });

      toast({
        title: "Success",
        description: "Comment added successfully!",
      });

      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      // Revert optimistic update on error
      setPosts(prevPosts => prevPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments_count: Math.max(0, post.comments_count - 1)
          };
        }
        return post;
      }));
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
      return false;
    }
  };

  // Delete a post
  const deletePost = async (postId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id); // Ensure user can only delete their own posts

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully!",
      });

      await fetchPosts(); // Refresh posts
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
      return false;
    }
  };

  // Fetch public profile
  const fetchPublicProfile = async (userId: string): Promise<PublicProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching public profile:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [user]);

  return {
    posts,
    loading,
    fetchPosts,
    createPost,
    deletePost,
    toggleLike,
    fetchComments,
    addComment,
    fetchPublicProfile,
  };
};