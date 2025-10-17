import { useState, useEffect } from 'react';
import { useBlockUser } from '@/hooks/useBlockUser';
import { useConnectSettings } from '@/hooks/useConnectSettings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserX, Shield, Bell, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BlockedUserProfile {
  blockId: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  school: string | null;
  major: string | null;
  blockedAt: string;
}

export const ConnectSettings = () => {
  const { unblockUser, loading: blockLoading, getBlockedUsersWithProfiles } = useBlockUser();
  const { settings, loading: settingsLoading, updateSettings } = useConnectSettings();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserProfile[]>([]);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    const users = await getBlockedUsersWithProfiles();
    setBlockedUsers(users);
  };

  const handleUnblock = async (userId: string) => {
    const success = await unblockUser(userId);
    if (success) {
      await loadBlockedUsers();
    }
  };

  return (
    <Tabs defaultValue="blocked" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="blocked" className="flex items-center gap-2">
          <UserX className="h-4 w-4" />
          <span className="hidden sm:inline">Blocked</span>
        </TabsTrigger>
        <TabsTrigger value="privacy" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">Privacy</span>
        </TabsTrigger>
        <TabsTrigger value="notifications" className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Notifications</span>
        </TabsTrigger>
        <TabsTrigger value="filters" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="blocked" className="space-y-4 mt-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Blocked Users</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Users you've blocked won't be able to see your posts or message you.
          </p>
        </div>

        {blockedUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserX className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No blocked users</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((user) => (
              <div
                key={user.blockId}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback>
                      {user.displayName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.displayName || 'Unknown User'}</p>
                    <p className="text-sm text-muted-foreground">
                      {[user.major, user.school].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(user.userId)}
                  disabled={blockLoading}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="privacy" className="space-y-6 mt-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Privacy Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Control who can interact with you and see your content.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-messages">Allow messages from non-friends</Label>
              <p className="text-sm text-muted-foreground">
                Let people who aren't your friends send you messages
              </p>
            </div>
            <Switch
              id="allow-messages"
              checked={settings.privacy.allowMessagesFromNonFriends}
              onCheckedChange={(checked) =>
                updateSettings({
                  privacy: { ...settings.privacy, allowMessagesFromNonFriends: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="online-status">Show online status</Label>
              <p className="text-sm text-muted-foreground">
                Let friends see when you're online
              </p>
            </div>
            <Switch
              id="online-status"
              checked={settings.privacy.showOnlineStatus}
              onCheckedChange={(checked) =>
                updateSettings({
                  privacy: { ...settings.privacy, showOnlineStatus: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Default post visibility</Label>
            <Select
              value={settings.privacy.defaultPostVisibility}
              onValueChange={(value: any) =>
                updateSettings({
                  privacy: { ...settings.privacy, defaultPostVisibility: value },
                })
              }
              disabled={settingsLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="friends-only">Friends Only</SelectItem>
                <SelectItem value="school-only">School Only</SelectItem>
                <SelectItem value="major-only">Major Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose who can see your posts by default
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6 mt-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose what notifications you want to receive.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify-comments">New comments</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone comments on your posts
              </p>
            </div>
            <Switch
              id="notify-comments"
              checked={settings.notifications.notifyOnComments}
              onCheckedChange={(checked) =>
                updateSettings({
                  notifications: { ...settings.notifications, notifyOnComments: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify-likes">New likes</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone likes your posts
              </p>
            </div>
            <Switch
              id="notify-likes"
              checked={settings.notifications.notifyOnLikes}
              onCheckedChange={(checked) =>
                updateSettings({
                  notifications: { ...settings.notifications, notifyOnLikes: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notify-mentions">Mentions</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when someone mentions you
              </p>
            </div>
            <Switch
              id="notify-mentions"
              checked={settings.notifications.notifyOnMentions}
              onCheckedChange={(checked) =>
                updateSettings({
                  notifications: { ...settings.notifications, notifyOnMentions: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="filters" className="space-y-6 mt-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Content Filters</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Customize what content you see in your feed.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="hide-no-images">Hide posts without images</Label>
              <p className="text-sm text-muted-foreground">
                Only show posts that include images
              </p>
            </div>
            <Switch
              id="hide-no-images"
              checked={settings.contentFilters.hidePostsWithoutImages}
              onCheckedChange={(checked) =>
                updateSettings({
                  contentFilters: { ...settings.contentFilters, hidePostsWithoutImages: checked },
                })
              }
              disabled={settingsLoading}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};
