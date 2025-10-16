import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';

export type BudgetType = 'daily' | 'lifetime';

export interface BudgetConfig {
  type: BudgetType;
  amount: number;
  duration: number;
  totalBudget: number;
}

interface BudgetStepProps {
  budget: BudgetConfig;
  onBudgetChange: (budget: BudgetConfig) => void;
}

const BUDGET_TIERS = [
  { id: 'starter', amount: 5, label: 'Starter', impressions: 500, description: 'Testing the waters' },
  { id: 'growth', amount: 10, label: 'Growth', impressions: 1200, description: 'Building momentum' },
  { id: 'pro', amount: 25, label: 'Pro', impressions: 3500, description: 'Maximum reach' },
];

const DURATION_OPTIONS = [3, 7, 14, 30];

export const BudgetStep: React.FC<BudgetStepProps> = ({ budget, onBudgetChange }) => {
  const updateBudget = (updates: Partial<BudgetConfig>) => {
    const newBudget = { ...budget, ...updates };
    newBudget.totalBudget = newBudget.type === 'daily' 
      ? newBudget.amount * newBudget.duration 
      : newBudget.amount;
    onBudgetChange(newBudget);
  };

  const selectTier = (amount: number) => {
    updateBudget({ amount: budget.type === 'daily' ? amount : amount * budget.duration });
  };

  const isCustomBudget = budget.type === 'daily' 
    ? !BUDGET_TIERS.some(tier => tier.amount === budget.amount)
    : !BUDGET_TIERS.some(tier => tier.amount * budget.duration === budget.amount);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Budget & Duration</h3>
        <p className="text-sm text-muted-foreground">Set your campaign budget and timeline</p>
      </div>

      {/* Budget Type */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Budget Type</Label>
        <RadioGroup value={budget.type} onValueChange={(type) => updateBudget({ type: type as BudgetType })}>
          <Card
            className={`cursor-pointer transition-all ${
              budget.type === 'daily' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
            }`}
            onClick={() => updateBudget({ type: 'daily' })}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <RadioGroupItem value="daily" id="daily" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="daily" className="text-base font-semibold cursor-pointer">
                  Daily Budget
                </Label>
                <p className="text-sm text-muted-foreground">Spend up to $X per day - more consistent delivery</p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              budget.type === 'lifetime' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
            }`}
            onClick={() => updateBudget({ type: 'lifetime' })}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <RadioGroupItem value="lifetime" id="lifetime" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="lifetime" className="text-base font-semibold cursor-pointer">
                  Total Budget (Lifetime)
                </Label>
                <p className="text-sm text-muted-foreground">Spend $X total - faster spending, less control</p>
              </div>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {/* Budget Amount */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Choose Your Budget:</Label>
        <div className="grid gap-3">
          {BUDGET_TIERS.map((tier) => {
            const isSelected = budget.type === 'daily'
              ? budget.amount === tier.amount
              : budget.amount === tier.amount * budget.duration;
            
            return (
              <Card
                key={tier.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                }`}
                onClick={() => selectTier(tier.amount)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {tier.label} - ${tier.amount}/{budget.type === 'daily' ? 'day' : 'total'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ~{tier.impressions.toLocaleString()} impressions/day
                      </p>
                      <p className="text-xs text-muted-foreground">Best for: {tier.description}</p>
                    </div>
                    {tier.id === 'growth' && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Custom Budget */}
          <Card className={`${isCustomBudget ? 'border-primary bg-primary/5' : ''}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Custom Amount</p>
                <p className="text-2xl font-bold">${budget.amount}</p>
              </div>
              <Slider
                value={[budget.amount]}
                onValueChange={([amount]) => updateBudget({ amount })}
                min={5}
                max={budget.type === 'daily' ? 100 : 1000}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$5</span>
                <span>${budget.type === 'daily' ? '100' : '1,000'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">How long should we promote?</Label>
        <div className="grid grid-cols-4 gap-2">
          {DURATION_OPTIONS.map((days) => (
            <Button
              key={days}
              variant={budget.duration === days ? 'default' : 'outline'}
              onClick={() => updateBudget({ duration: days })}
              className="w-full"
            >
              {days}d
            </Button>
          ))}
        </div>
        {budget.duration < 5 && (
          <p className="text-xs text-amber-600">
            ⚠️ Short campaigns may not optimize fully
          </p>
        )}
      </div>

      {/* Learning Note */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm space-y-2">
        <p className="font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          💡 Learning Note
        </p>
        <p className="text-muted-foreground text-xs">
          Results stabilize after 3-5 days. Avoid major edits mid-campaign for best performance.
          7 days is recommended to capture weekday + weekend behavior.
        </p>
      </div>

      {/* Total Summary */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Budget</p>
              <p className="text-2xl font-bold">${budget.totalBudget}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">
                ${(budget.totalBudget / budget.duration).toFixed(2)}/day
              </p>
              <p className="text-sm text-muted-foreground">
                {budget.duration} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
