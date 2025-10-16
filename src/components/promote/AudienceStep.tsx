import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Target, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { universities } from '@/data/universities';

export type AudienceMode = 'automatic' | 'manual';

export interface AudienceConfig {
  mode: AudienceMode;
  estimatedReach: number;
  locations: string[];
  ageRange: [number, number];
  gender: 'all' | 'male' | 'female';
  interests: string[];
}

interface AudienceStepProps {
  audience: AudienceConfig;
  onAudienceChange: (audience: AudienceConfig) => void;
  userSchool?: string;
  userMajor?: string;
}

const SUGGESTED_INTERESTS = [
  'Computer Science', 'Engineering', 'Business', 'Pre-Med', 'Arts',
  'Basketball', 'Football', 'Soccer', 'Fitness', 'Gaming',
  'Study Groups', 'Greek Life', 'Student Government', 'Music', 'Photography'
];

export const AudienceStep: React.FC<AudienceStepProps> = ({
  audience,
  onAudienceChange,
  userSchool,
  userMajor
}) => {
  const [newInterest, setNewInterest] = useState('');

  const updateAudience = (updates: Partial<AudienceConfig>) => {
    onAudienceChange({ ...audience, ...updates });
  };

  const addLocation = (school: string) => {
    if (!audience.locations.includes(school)) {
      updateAudience({ locations: [...audience.locations, school] });
    }
  };

  const removeLocation = (school: string) => {
    updateAudience({ locations: audience.locations.filter(s => s !== school) });
  };

  const addInterest = (interest: string) => {
    if (interest && !audience.interests.includes(interest) && audience.interests.length < 8) {
      updateAudience({ interests: [...audience.interests, interest] });
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    updateAudience({ interests: audience.interests.filter(i => i !== interest) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Who should see this?</h3>
        <p className="text-sm text-muted-foreground">Define your target audience</p>
      </div>

      <RadioGroup value={audience.mode} onValueChange={(mode) => updateAudience({ mode: mode as AudienceMode })}>
        <Card
          className={`cursor-pointer transition-all ${
            audience.mode === 'automatic' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
          }`}
          onClick={() => updateAudience({ mode: 'automatic' })}
        >
          <CardContent className="flex items-start gap-4 p-4">
            <RadioGroupItem value="automatic" id="automatic" className="mt-1" />
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <Label htmlFor="automatic" className="text-base font-semibold cursor-pointer">
                  Automatic (Recommended)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll show it to students like your current followers and engagers
                </p>
                <p className="text-xs text-primary font-medium mt-2">
                  Estimated reach: ~5,000 students at similar schools
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            audience.mode === 'manual' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
          }`}
          onClick={() => updateAudience({ mode: 'manual' })}
        >
          <CardContent className="flex items-start gap-4 p-4">
            <RadioGroupItem value="manual" id="manual" className="mt-1" />
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-muted">
                <Target className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <Label htmlFor="manual" className="text-base font-semibold cursor-pointer">
                  Manual Targeting
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose specific schools, majors, and interests
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </RadioGroup>

      {audience.mode === 'manual' && (
        <div className="space-y-6 pt-4 border-t">
          {/* School Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Schools</Label>
            <Select onValueChange={addLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Add a school" />
              </SelectTrigger>
              <SelectContent>
                {universities.slice(0, 50).map((uni) => (
                  <SelectItem key={uni.id} value={uni.name}>
                    {uni.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {audience.locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {audience.locations.map((school) => (
                  <Badge key={school} variant="secondary" className="gap-1">
                    {school}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeLocation(school)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Age Range */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Age Range</Label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ages {audience.ageRange[0]} - {audience.ageRange[1]}</span>
              </div>
              <Slider
                value={audience.ageRange}
                onValueChange={(value) => updateAudience({ ageRange: value as [number, number] })}
                min={18}
                max={65}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Gender</Label>
            <RadioGroup value={audience.gender} onValueChange={(gender) => updateAudience({ gender: gender as any })}>
              <div className="flex gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Interests */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Interests (3-8)</Label>
              <span className="text-xs text-muted-foreground">{audience.interests.length}/8</span>
            </div>
            <div className="flex gap-2">
              <Select onValueChange={addInterest}>
                <SelectTrigger>
                  <SelectValue placeholder="Add an interest" />
                </SelectTrigger>
                <SelectContent>
                  {SUGGESTED_INTERESTS.filter(i => !audience.interests.includes(i)).map((interest) => (
                    <SelectItem key={interest} value={interest}>
                      {interest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {audience.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {audience.interests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="gap-1">
                    {interest}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeInterest(interest)}
                    />
                  </Badge>
                ))}
              </div>
            )}
            {audience.interests.length < 3 && (
              <p className="text-xs text-amber-600">Add at least 3 interests for better targeting</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
