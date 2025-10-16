import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Home, Compass, User, Film, Star } from 'lucide-react';

export type Placement = 'main_feed' | 'explore' | 'profile_feed' | 'stories';

interface PlacementsStepProps {
  selectedPlacements: Placement[];
  onPlacementsChange: (placements: Placement[]) => void;
  hasImage: boolean;
}

const PLACEMENTS = [
  {
    id: 'main_feed' as Placement,
    title: 'Main Feed',
    description: 'Your post in the home feed',
    performance: 5,
    icon: Home,
    enabled: true,
  },
  {
    id: 'explore' as Placement,
    title: 'Explore Page',
    description: 'Discover section for new users',
    performance: 4,
    icon: Compass,
    enabled: true,
  },
  {
    id: 'profile_feed' as Placement,
    title: 'Profile Feed',
    description: 'Top of your profile page',
    performance: 3,
    icon: User,
    enabled: true,
  },
  {
    id: 'stories' as Placement,
    title: 'Stories',
    description: 'Ephemeral 24-hour format',
    performance: 0,
    icon: Film,
    enabled: false,
    comingSoon: true,
  },
];

export const PlacementsStep: React.FC<PlacementsStepProps> = ({
  selectedPlacements,
  onPlacementsChange,
  hasImage
}) => {
  const togglePlacement = (placementId: Placement) => {
    if (selectedPlacements.includes(placementId)) {
      onPlacementsChange(selectedPlacements.filter(p => p !== placementId));
    } else {
      onPlacementsChange([...selectedPlacements, placementId]);
    }
  };

  const renderStars = (count: number) => {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < count ? 'fill-primary text-primary' : 'fill-muted text-muted'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Where should your post appear?</h3>
        <p className="text-sm text-muted-foreground">Select one or more placements</p>
      </div>

      <div className="space-y-3">
        {PLACEMENTS.map((placement) => {
          const Icon = placement.icon;
          const isSelected = selectedPlacements.includes(placement.id);
          const isDisabled = !placement.enabled;

          return (
            <Card
              key={placement.id}
              className={`transition-all ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : isSelected
                  ? 'border-primary bg-primary/5 cursor-pointer'
                  : 'cursor-pointer hover:border-muted-foreground/50'
              }`}
              onClick={() => !isDisabled && togglePlacement(placement.id)}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <Checkbox
                  checked={isSelected}
                  disabled={isDisabled}
                  className="mt-1"
                />
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold cursor-pointer">
                        {placement.title}
                        {placement.comingSoon && (
                          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Coming Soon</span>
                        )}
                      </Label>
                      {placement.enabled && (
                        <div className="flex items-center gap-2">
                          {renderStars(placement.performance)}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{placement.description}</p>
                    {placement.id === 'main_feed' && hasImage && (
                      <p className="text-xs text-primary">
                        ⚡ Posts with images get 3x more engagement in Main Feed
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedPlacements.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
          <p className="text-amber-600">Please select at least one placement to continue</p>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
        <p className="font-medium">💡 Tip: Main Feed + Explore</p>
        <p className="text-muted-foreground text-xs mt-1">
          This combination typically delivers the best reach and engagement
        </p>
      </div>
    </div>
  );
};
