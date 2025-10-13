import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from './ui/use-toast';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ModerationItem {
  id: string;
  content: string;
  content_type: 'post' | 'comment';
  moderation_status: string;
  moderation_score: number;
  moderation_flags: any;
  created_at: string;
  user_id: string;
}

export const ModerationDashboard = () => {
  const { canModerate } = useUserRole();
  const [flaggedContent, setFlaggedContent] = useState<ModerationItem[]>([]);
  const [hiddenContent, setHiddenContent] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canModerate) return;
    fetchContent();

    // Real-time subscription for new flagged content
    const channel = supabase
      .channel('moderation-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
        filter: 'moderation_status=in.(flagged,auto_hidden)'
      }, fetchContent)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: 'moderation_status=in.(flagged,auto_hidden)'
      }, fetchContent)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canModerate]);

  const fetchContent = async () => {
    setLoading(true);

    // Fetch flagged posts
    const { data: flaggedPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('moderation_status', 'flagged')
      .order('created_at', { ascending: false });

    // Fetch flagged comments
    const { data: flaggedComments } = await supabase
      .from('comments')
      .select('*')
      .eq('moderation_status', 'flagged')
      .order('created_at', { ascending: false });

    // Fetch auto-hidden posts
    const { data: hiddenPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('moderation_status', 'auto_hidden')
      .order('created_at', { ascending: false });

    // Fetch auto-hidden comments
    const { data: hiddenComments } = await supabase
      .from('comments')
      .select('*')
      .eq('moderation_status', 'auto_hidden')
      .order('created_at', { ascending: false });

    const flagged = [
      ...(flaggedPosts || []).map(p => ({ ...p, content_type: 'post' as const })),
      ...(flaggedComments || []).map(c => ({ ...c, content_type: 'comment' as const }))
    ];

    const hidden = [
      ...(hiddenPosts || []).map(p => ({ ...p, content_type: 'post' as const })),
      ...(hiddenComments || []).map(c => ({ ...c, content_type: 'comment' as const }))
    ];

    setFlaggedContent(flagged);
    setHiddenContent(hidden);
    setLoading(false);
  };

  const handleModeration = async (
    itemId: string,
    contentType: 'post' | 'comment',
    action: 'approve' | 'reject'
  ) => {
    const table = contentType === 'post' ? 'posts' : 'comments';
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from(table)
      .update({
        moderation_status: newStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', itemId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update moderation status',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: `Content ${action}ed successfully`
      });
      fetchContent();
    }
  };

  if (!canModerate) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              You don't have permission to access the moderation dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Content Moderation</h1>

      <Tabs defaultValue="flagged" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="flagged">
            Flagged for Review ({flaggedContent.length})
          </TabsTrigger>
          <TabsTrigger value="hidden">
            Auto-Hidden ({hiddenContent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flagged">
          <div className="space-y-4">
            {flaggedContent.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No flagged content to review
                  </p>
                </CardContent>
              </Card>
            ) : (
              flaggedContent.map((item) => (
                <ModerationCard
                  key={item.id}
                  item={item}
                  onApprove={() => handleModeration(item.id, item.content_type, 'approve')}
                  onReject={() => handleModeration(item.id, item.content_type, 'reject')}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="hidden">
          <div className="space-y-4">
            {hiddenContent.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No auto-hidden content
                  </p>
                </CardContent>
              </Card>
            ) : (
              hiddenContent.map((item) => (
                <ModerationCard
                  key={item.id}
                  item={item}
                  onApprove={() => handleModeration(item.id, item.content_type, 'approve')}
                  onReject={() => handleModeration(item.id, item.content_type, 'reject')}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ModerationCard = ({
  item,
  onApprove,
  onReject
}: {
  item: ModerationItem;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const getSeverityColor = (score: number) => {
    if (score > 80) return 'destructive';
    if (score > 50) return 'default';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {item.content_type === 'post' ? 'Post' : 'Comment'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {new Date(item.created_at).toLocaleString()}
            </p>
          </div>
          <Badge variant={getSeverityColor(item.moderation_score)}>
            Score: {item.moderation_score}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="whitespace-pre-wrap">{item.content}</p>
          </div>

          {item.moderation_flags && Array.isArray(item.moderation_flags) && item.moderation_flags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.moderation_flags.map((flag: string, index: number) => (
                <Badge key={index} variant="outline">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {flag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onApprove} variant="outline" className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button onClick={onReject} variant="destructive" className="flex-1">
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};