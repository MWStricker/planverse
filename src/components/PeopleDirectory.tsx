import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  UserPlus, 
  MessageCircle, 
  School, 
  GraduationCap, 
  Users,
  UserCheck,
  Clock,
  X
} from 'lucide-react';
import { usePeople, Person } from '@/hooks/usePeople';
import { useFriends } from '@/hooks/useFriends';
import { PublicProfile } from './PublicProfile';
import { SuggestedConnections } from './SuggestedConnections';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { OnlineStatus } from './OnlineStatus';
import { UserStatusIndicator } from './UserStatusIndicator';
import { useRealtime } from '@/hooks/useRealtime';

interface PeopleDirectoryProps {
  onStartChat?: (userId: string) => void;
}

export const PeopleDirectory: React.FC<PeopleDirectoryProps> = ({ onStartChat }) => {
  const { toast } = useToast();
  const { getUserStatus } = useRealtime();
  const { 
    people, 
    loading, 
    searchPeople, 
    fetchPeople,
    fetchPeopleBySchool, 
    fetchPeopleByMajor,
    getPersonByUserId 
  } = usePeople();
  const { 
    friends, 
    friendRequests, 
    sentRequests,
    sendFriendRequest, 
    respondToFriendRequest,
    checkFriendshipStatus 
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'school' | 'major'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [friendshipStatuses, setFriendshipStatuses] = useState<Record<string, string>>({});

  const getExcludedUserIds = (): string[] => {
    const friendIds = friends.map(f => f.friend_profile?.user_id).filter(Boolean) as string[];
    const sentRequestIds = sentRequests.map(r => r.receiver_id);
    const receivedRequestIds = friendRequests.map(r => r.sender_id);
    
    return [...friendIds, ...sentRequestIds, ...receivedRequestIds];
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const excludedIds = getExcludedUserIds();
    searchPeople(query, excludedIds);
  };

  const handleFilter = (filterType: 'all' | 'school' | 'major', value?: string) => {
    setSelectedFilter(filterType);
    setFilterValue(value || '');
    const excludedIds = getExcludedUserIds();
    
    if (filterType === 'school' && value) {
      fetchPeopleBySchool(value, excludedIds);
    } else if (filterType === 'major' && value) {
      fetchPeopleByMajor(value, excludedIds);
    } else {
      fetchPeople(undefined, excludedIds);
    }
  };

  const handleSendFriendRequest = async (personId: string) => {
    const success = await sendFriendRequest(personId);
    if (success) {
      toast({
        title: "Friend Request Sent",
        description: "Your friend request has been sent!",
      });
      // Update status
      const status = await checkFriendshipStatus(personId);
      setFriendshipStatuses(prev => ({ ...prev, [personId]: status }));
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    const success = await respondToFriendRequest(requestId, accept);
    if (success) {
      toast({
        title: accept ? "Friend Request Accepted" : "Friend Request Declined",
        description: accept ? "You are now friends!" : "Friend request declined.",
      });
    }
  };

  const handleViewProfile = async (person: Person) => {
    const fullProfile = await getPersonByUserId(person.user_id);
    if (fullProfile) {
      setSelectedPerson(fullProfile);
    }
  };

  // Refetch people when friends list changes to filter them out
  useEffect(() => {
    const excludedIds = getExcludedUserIds();
    if (selectedFilter === 'school' && filterValue) {
      fetchPeopleBySchool(filterValue, excludedIds);
    } else if (selectedFilter === 'major' && filterValue) {
      fetchPeopleByMajor(filterValue, excludedIds);
    } else {
      fetchPeople(searchQuery || undefined, excludedIds);
    }
  }, [friends, friendRequests, sentRequests]);

  // Load friendship statuses for visible people
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses: Record<string, string> = {};
      for (const person of people) {
        const status = await checkFriendshipStatus(person.user_id);
        statuses[person.user_id] = status;
      }
      setFriendshipStatuses(statuses);
    };

    if (people.length > 0) {
      loadStatuses();
    }
  }, [people]);

  const getUniqueSchools = () => {
    const schools = people.map(p => p.school).filter(Boolean);
    return [...new Set(schools)];
  };

  const getUniqueMajors = () => {
    const majors = people.map(p => p.major).filter(Boolean);
    return [...new Set(majors)];
  };

  const renderPersonCard = (person: Person) => {
    const status = friendshipStatuses[person.user_id] || 'none';
    
    return (
      <Card 
        key={person.id} 
        className="hover:shadow-md transition-shadow cursor-pointer group"
        onClick={() => handleViewProfile(person)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={person.avatar_url} />
              <AvatarFallback>
                {person.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-foreground group-hover:text-primary truncate">
                  {person.display_name}
                </h4>
                <UserStatusIndicator 
                  status={getUserStatus(person.user_id)} 
                  isCurrentUser={false}
                  size="sm"
                />
              </div>
              
              <div className="flex flex-wrap gap-1 mb-2">
                <OnlineStatus userId={person.user_id} />
                {person.school && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <School className="h-3 w-3" />
                    {person.school}
                  </Badge>
                )}
                {person.major && (
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <GraduationCap className="h-3 w-3" />
                    {person.major}
                  </Badge>
                )}
                {person.graduation_year && (
                  <Badge variant="outline" className="text-xs">
                    Class of {person.graduation_year}
                  </Badge>
                )}
              </div>
              
              {person.bio && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {person.bio}
                </p>
              )}
              
              <div className="flex justify-center">
                {status === 'none' && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendFriendRequest(person.user_id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    Connect
                  </Button>
                )}
                {status === 'sent' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled 
                    className="flex items-center gap-1"
                  >
                    <Clock className="h-4 w-4" />
                    Pending
                  </Button>
                )}
                {status === 'received' && (
                  <Button 
                    size="sm" 
                    variant="secondary"
                    disabled
                    className="flex items-center gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
                    Request Received
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Friends ({friends.length})
          </TabsTrigger>
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Requests ({friendRequests.length})
          </TabsTrigger>
          <TabsTrigger value="suggested" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Suggested
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {friends.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">No friends yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by discovering and adding people!
                </p>
                <Button onClick={() => {
                  const discoverTab = document.querySelector('[value="discover"]');
                  if (discoverTab) (discoverTab as HTMLButtonElement).click();
                }}>
                  Discover People
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {friends.map((friend) => (
                    <div 
                      key={friend.id}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={friend.friend_profile?.avatar_url} />
                        <AvatarFallback>
                          {friend.friend_profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => friend.friend_profile?.user_id && handleViewProfile({
                          id: friend.friend_profile.id,
                          user_id: friend.friend_profile.user_id,
                          display_name: friend.friend_profile.display_name,
                          avatar_url: friend.friend_profile.avatar_url,
                          school: friend.friend_profile.school,
                          major: friend.friend_profile.major,
                          bio: friend.friend_profile.bio,
                          created_at: friend.created_at
                        } as Person)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground truncate hover:text-primary">
                            {friend.friend_profile?.display_name || 'Unknown User'}
                          </h4>
                          {friend.friend_profile?.user_id && (
                            <UserStatusIndicator 
                              status={getUserStatus(friend.friend_profile.user_id)} 
                              isCurrentUser={false}
                              size="sm"
                            />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {friend.friend_profile?.school && (
                            <span className="flex items-center gap-1">
                              <School className="h-3 w-3" />
                              {friend.friend_profile.school}
                            </span>
                          )}
                          {friend.friend_profile?.school && friend.friend_profile?.major && (
                            <span>•</span>
                          )}
                          {friend.friend_profile?.major && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {friend.friend_profile.major}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {friend.friend_profile?.user_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartChat?.(friend.friend_profile!.user_id);
                            }}
                            className="flex items-center gap-1"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Message
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Discover People
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name, school, major, or bio..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
              
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedFilter}
                  onValueChange={(value: 'all' | 'school' | 'major') => {
                    setSelectedFilter(value);
                    if (value === 'all') {
                      handleSearch(searchQuery);
                    }
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    side="bottom" 
                    sideOffset={8} 
                    collisionPadding={8} 
                    avoidCollisions={false}
                    className="bg-popover border border-border shadow-lg z-50"
                  >
                    <SelectItem value="all">All People</SelectItem>
                    <SelectItem value="school">By School</SelectItem>
                    <SelectItem value="major">By Major</SelectItem>
                  </SelectContent>
                </Select>
                
                {selectedFilter === 'school' && (
                  <Select
                    value={filterValue}
                    onValueChange={(value) => handleFilter('school', value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent 
                      side="bottom" 
                      sideOffset={8} 
                      collisionPadding={8} 
                      avoidCollisions={false}
                      className="bg-popover border border-border shadow-lg z-50 max-h-[300px]"
                    >
                      {getUniqueSchools().map((school) => (
                        <SelectItem key={school} value={school!}>
                          {school}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {selectedFilter === 'major' && (
                  <Select
                    value={filterValue}
                    onValueChange={(value) => handleFilter('major', value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select major" />
                    </SelectTrigger>
                    <SelectContent 
                      side="bottom" 
                      sideOffset={8} 
                      collisionPadding={8} 
                      avoidCollisions={false}
                      className="bg-popover border border-border shadow-lg z-50 max-h-[300px]"
                    >
                      {getUniqueMajors().map((major) => (
                        <SelectItem key={major} value={major!}>
                          {major}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* People Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {people.map(renderPersonCard)}
          </div>
          
          {people.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No people found. Try adjusting your search or filters.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {friendRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Friend Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friendRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={async () => {
                        if (request.sender_id) {
                          const fullProfile = await getPersonByUserId(request.sender_id);
                          if (fullProfile) {
                            setSelectedPerson(fullProfile);
                          } else {
                            toast({
                              title: "Profile Not Available",
                              description: "Unable to load this user's profile.",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.sender_profile?.avatar_url} />
                        <AvatarFallback>
                          {request.sender_profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground hover:text-primary transition-colors">
                            {request.sender_profile?.display_name || 'Unknown User'}
                          </h4>
                          <UserStatusIndicator 
                            status={getUserStatus(request.sender_id)} 
                            isCurrentUser={false}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {request.sender_profile?.school && (
                            <span>{request.sender_profile.school}</span>
                          )}
                          {request.sender_profile?.major && (
                            <>
                              <span>•</span>
                              <span>{request.sender_profile.major}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRespondToRequest(request.id, true);
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRespondToRequest(request.id, false);
                        }}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {sentRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sent Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sentRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={async () => {
                      if (request.receiver_id) {
                        const fullProfile = await getPersonByUserId(request.receiver_id);
                        if (fullProfile) {
                          setSelectedPerson(fullProfile);
                        } else {
                          toast({
                            title: "Profile Not Available",
                            description: "Unable to load this user's profile.",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.receiver_profile?.avatar_url} />
                        <AvatarFallback>
                          {request.receiver_profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground hover:text-primary transition-colors">
                            {request.receiver_profile?.display_name || 'Unknown User'}
                          </h4>
                          <UserStatusIndicator 
                            status={getUserStatus(request.receiver_id)} 
                            isCurrentUser={false}
                            size="sm"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">Request pending</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {friendRequests.length === 0 && sentRequests.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No pending friend requests.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="suggested" className="space-y-4">
          <SuggestedConnections />
        </TabsContent>
      </Tabs>

      {/* Profile Dialog */}
      <Dialog open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPerson && (
            <PublicProfile 
              profile={{
                id: selectedPerson.id,
                user_id: selectedPerson.user_id,
                display_name: selectedPerson.display_name,
                avatar_url: selectedPerson.avatar_url,
                school: selectedPerson.school,
                major: selectedPerson.major,
                bio: selectedPerson.bio,
                graduation_year: selectedPerson.graduation_year,
                is_public: true
              }}
              onSendMessage={() => {
                setSelectedPerson(null);
                onStartChat?.(selectedPerson.user_id);
              }}
              onAddFriend={friendshipStatuses[selectedPerson.user_id] === 'friends' ? undefined : () => {
                handleSendFriendRequest(selectedPerson.user_id);
                setSelectedPerson(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};