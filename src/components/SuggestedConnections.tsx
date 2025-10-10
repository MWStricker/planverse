import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSuggestedMatches, getMatchScoreColor, getMatchScoreBgColor, getMatchScoreLabel, MatchedUser } from '@/lib/matching-utils';
import { UserPlus, Music, GraduationCap, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const SuggestedConnections = () => {
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    const data = await fetchSuggestedMatches(20);
    setMatches(data);
    setLoading(false);
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      setSendingRequest(userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      // Remove from suggested matches
      setMatches(prev => prev.filter(m => m.user_id !== userId));
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      if (error.code === '23505') {
        toast.error('Friend request already sent');
      } else {
        toast.error('Failed to send friend request');
      }
    } finally {
      setSendingRequest(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle className="mb-2">No matches yet</CardTitle>
          <CardDescription>
            Complete your onboarding to get personalized connection suggestions, or check back later for new matches!
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Suggested Connections</h2>
          <p className="text-sm text-muted-foreground">People who share your interests</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMatches}>
          Refresh
        </Button>
      </div>

      {matches.map(match => {
        const matchScore = Math.round(match.match_score);
        const scoreColor = getMatchScoreColor(matchScore);
        const scoreBgColor = getMatchScoreBgColor(matchScore);
        const scoreLabel = getMatchScoreLabel(matchScore);

        return (
          <Card key={match.user_id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={match.avatar_url} alt={match.display_name} />
                  <AvatarFallback>{match.display_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{match.display_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {match.school && <span>{match.school}</span>}
                        {match.major && (
                          <>
                            <span>•</span>
                            <span>{match.major}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className={`${scoreBgColor} ${scoreColor} border-0`}>
                      {matchScore}% {scoreLabel}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {match.shared_interests?.music && (
                      <div className="flex items-center gap-2 text-sm">
                        <Music className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Music:</span>
                        <span className="font-medium">{match.shared_interests.music}</span>
                      </div>
                    )}
                    {match.shared_interests?.year && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Year:</span>
                        <span className="font-medium">{match.shared_interests.year}</span>
                      </div>
                    )}
                    {match.shared_interests?.clubs && match.shared_interests.clubs.length > 0 && (
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-muted-foreground">Clubs:</span>
                        <div className="flex gap-1 flex-wrap">
                          {match.shared_interests.clubs.slice(0, 3).map((club, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {club}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleSendFriendRequest(match.user_id)}
                    disabled={sendingRequest === match.user_id}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {sendingRequest === match.user_id ? 'Sending...' : 'Connect'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
