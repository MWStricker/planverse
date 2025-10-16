import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserPlus, Heart, MessageCircle } from 'lucide-react';

export type PromotionGoal = 'profile_visits' | 'engagement' | 'messages';

interface GoalStepProps {
  selectedGoal: PromotionGoal;
  onGoalChange: (goal: PromotionGoal) => void;
}

const GOALS = [
  {
    id: 'profile_visits' as PromotionGoal,
    title: 'Profile Visits',
    description: 'Best for: Building your following',
    cost: '~$0.10-$0.30 per visit',
    icon: UserPlus,
  },
  {
    id: 'engagement' as PromotionGoal,
    title: 'Post Engagement',
    description: 'Best for: Spreading awareness',
    cost: '~$0.05-$0.15 per engagement',
    icon: Heart,
  },
  {
    id: 'messages' as PromotionGoal,
    title: 'Messages',
    description: 'Best for: Direct conversations',
    cost: '~$0.50-$1.50 per message',
    icon: MessageCircle,
  },
];

export const GoalStep: React.FC<GoalStepProps> = ({ selectedGoal, onGoalChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">What's your goal?</h3>
        <p className="text-sm text-muted-foreground">Choose what you want to achieve with this promotion</p>
      </div>

      <RadioGroup value={selectedGoal} onValueChange={onGoalChange}>
        <div className="space-y-3">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            return (
              <Card
                key={goal.id}
                className={`cursor-pointer transition-all ${
                  selectedGoal === goal.id ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                }`}
                onClick={() => onGoalChange(goal.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <RadioGroupItem value={goal.id} id={goal.id} className="mt-1" />
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={goal.id} className="text-base font-semibold cursor-pointer">
                        {goal.title}
                      </Label>
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                      <p className="text-xs text-muted-foreground font-medium">{goal.cost}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </RadioGroup>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
        <p className="font-medium">💡 Recommended: Post Engagement</p>
        <p className="text-muted-foreground text-xs mt-1">
          Most cost-effective for building social proof and reaching more students
        </p>
      </div>
    </div>
  );
};
