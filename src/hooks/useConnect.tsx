import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
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
  id: string;
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  school?: string;
  major?: string;
  bio?: string;
  graduation_year?: number;
  is_public: boolean;
}

export const useConnect = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch posts with profile information
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!inner(display_name, avatar_url, school, major)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which posts current user has liked
      if (user) {
        const postIds = data?.map(post => post.id) || [];
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);

        const likedPostIds = new Set(likes?.map(like => like.post_id) || []);
        
        const postsWithLikes = data?.map(post => ({
          ...post,
          user_liked: likedPostIds.has(post.id)
        })) || [];

        setPosts(postsWithLikes);
      } else {
        setPosts(data || []);
      }
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
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content,
          image_url: imageUrl,
        });

      if (error) throw error;

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

      if (existingLike) {
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

      await fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error toggling like:', error);
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
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles!inner(display_name, avatar_url)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  };

  // Add a comment to a post
  const addComment = async (postId: string, content: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
        });

      if (error) throw error;

      // Update comments count
      await supabase.rpc('increment_comments_count', { post_id: postId });

      toast({
        title: "Success",
        description: "Comment added successfully!",
      });

      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
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
    toggleLike,
    fetchComments,
    addComment,
    fetchPublicProfile,
  };
};