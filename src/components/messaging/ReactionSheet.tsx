import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReactionCount } from '@/hooks/useReactions';

interface ReactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reactions: ReactionCount[];
}

export const ReactionSheet = ({ open, onOpenChange, reactions }: ReactionSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh]">
        <SheetHeader>
          <SheetTitle>Reactions</SheetTitle>
          <SheetDescription>
            See who reacted to this message
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {reactions.map(({ emoji, users }) => (
            <div key={emoji} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <span className="text-sm text-muted-foreground">
                  {users.length} {users.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>
                        {user.display_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{user.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
