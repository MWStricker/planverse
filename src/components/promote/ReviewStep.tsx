import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Target, Users, MapPin, Eye, TrendingUp, 
  DollarSign, Calendar, Shield, Bell, AlertTriangle 
} from 'lucide-react';
import type { PromotionGoal } from './GoalStep';
import type { AudienceConfig } from './AudienceStep';
import type { Placement } from './PlacementsStep';
import type { BudgetConfig } from './BudgetStep';

interface ReviewStepProps {
  goal: PromotionGoal;
  audience: AudienceConfig;
  placements: Placement[];
  budget: BudgetConfig;
  post: { id: string; content: string; image_url: string | null };
}

const GOAL_LABELS: Record<PromotionGoal, string> = {
  profile_visits: 'Profile Visits',
  engagement: 'Post Engagement',
  messages: 'Messages',
};

const PLACEMENT_LABELS: Record<Placement, string> = {
  main_feed: 'Main Feed',
  explore: 'Explore Page',
  profile_feed: 'Profile Feed',
  stories: 'Stories',
};

export const ReviewStep: React.FC<ReviewStepProps> = ({
  goal,
  audience,
  placements,
  budget,
  post
}) => {
  // Calculate estimates based on goal
  const estimatedImpressions = budget.totalBudget * 100;
  const estimatedReach = Math.floor(estimatedImpressions * 0.6);
  const estimatedEngagement = Math.floor(estimatedImpressions * 0.025);
  
  const costPerResult = goal === 'engagement' 
    ? 0.10 
    : goal === 'profile_visits' 
    ? 0.20 
    : 1.00;

  const estimatedResults = Math.floor(budget.totalBudget / costPerResult);
  const targetCPR = costPerResult * 1.5;

  const calculatePriorityScore = (totalBudget: number, days: number): number => {
    const budgetScore = Math.min((totalBudget / 500) * 50, 50);
    const durationScore = Math.min((days / 30) * 50, 50);
    return Math.round(budgetScore + durationScore);
  };

  const priorityScore = calculatePriorityScore(budget.totalBudget, budget.duration);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Campaign Summary</h3>
        <p className="text-sm text-muted-foreground">Review your promotion before activating</p>
      </div>

      {/* Configuration Summary */}
      <div className="grid gap-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Goal</p>
                <p className="text-sm text-muted-foreground">{GOAL_LABELS[goal]}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Audience</p>
                <p className="text-sm text-muted-foreground">
                  {audience.mode === 'automatic' 
                    ? `Automatic (~${audience.estimatedReach.toLocaleString()} students)`
                    : `Manual targeting`}
                </p>
                {audience.mode === 'manual' && audience.locations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {audience.locations.slice(0, 3).map((loc) => (
                      <Badge key={loc} variant="secondary" className="text-xs">
                        {loc}
                      </Badge>
                    ))}
                    {audience.locations.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{audience.locations.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Placements</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {placements.map((placement) => (
                    <Badge key={placement} variant="outline" className="text-xs">
                      {PLACEMENT_LABELS[placement]}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Budget</p>
                <p className="text-sm text-muted-foreground">
                  ${budget.totalBudget} total • ${(budget.totalBudget / budget.duration).toFixed(2)}/day • {budget.duration} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Estimates */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Estimated Performance</h4>
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">Impressions</span>
                </div>
                <p className="text-xl font-bold">~{estimatedImpressions.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Reach</span>
                </div>
                <p className="text-xl font-bold">~{estimatedReach.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">{GOAL_LABELS[goal]}</span>
                </div>
                <p className="text-xl font-bold">~{estimatedResults}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Cost/Result</span>
                </div>
                <p className="text-xl font-bold">~${costPerResult.toFixed(2)}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated CTR</span>
                <span className="font-medium">~2.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Frequency</span>
                <span className="font-medium">~1.7 views/user</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Priority Score</span>
                <span className="font-medium">{priorityScore}/100</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs & Targets */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Success Metrics</h4>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm">Primary KPI</p>
              <Badge variant="default">Cost Per {GOAL_LABELS[goal]}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">&lt; ${targetCPR.toFixed(2)}</span>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              We'll monitor CTR, frequency, and negative feedback to optimize delivery
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Guardrails */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Campaign Guardrails</h4>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm">Frequency cap: Max 3 views per user</p>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm">Auto-pause if CTR drops below 1% after 2 days</p>
            </div>
            <div className="flex items-start gap-3">
              <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm">Daily performance summary via email</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Notes */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">📊 What happens next:</p>
        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
          <li>Your post will be promoted starting immediately</li>
          <li>You'll receive daily performance updates</li>
          <li>Campaign runs for {budget.duration} days or until budget is spent</li>
          <li>View real-time analytics in the Promotions tab</li>
        </ul>
      </div>

      {/* iOS Fee Warning */}
      {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-amber-600">💰 Payment Method Notice</p>
          <p className="text-xs text-muted-foreground">
            iOS in-app purchases include a 30% App Store fee. To avoid this, use the desktop version or open in Safari.
          </p>
          <div className="flex gap-2 text-xs">
            <span>Mobile app: ${(budget.totalBudget * 1.30).toFixed(2)}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-green-600">Desktop/web: ${budget.totalBudget}</span>
          </div>
        </div>
      )}
    </div>
  );
};
