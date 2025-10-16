import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePromotedPosts } from '@/hooks/usePromotedPosts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// Step Components
import { GoalStep, PromotionGoal } from './promote/GoalStep';
import { AudienceStep, AudienceConfig } from './promote/AudienceStep';
import { PlacementsStep, Placement } from './promote/PlacementsStep';
import { BudgetStep, BudgetConfig } from './promote/BudgetStep';
import { EligibilityStep } from './promote/EligibilityStep';
import { ReviewStep } from './promote/ReviewStep';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface PromotePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post;
}

interface PromotionConfig {
  goal: PromotionGoal;
  audience: AudienceConfig;
  placements: Placement[];
  budget: BudgetConfig;
  metrics: {
    primary: string;
    primaryTarget: number;
    secondary: string[];
    guardrails: {
      frequencyCap: number;
      negativeFeedbackThreshold: number;
      ctrThreshold: number;
    };
  };
  reporting: {
    dailyEmail: boolean;
    inAppDashboard: boolean;
  };
}

const STEPS = [
  { id: 1, title: 'Goal', description: 'What do you want to achieve?' },
  { id: 2, title: 'Audience', description: 'Who should see this?' },
  { id: 3, title: 'Placements', description: 'Where to show your post?' },
  { id: 4, title: 'Budget', description: 'How much to spend?' },
  { id: 5, title: 'Eligibility', description: 'Check your content' },
  { id: 6, title: 'Review', description: 'Finalize your campaign' },
];

export const PromotePostDialog: React.FC<PromotePostDialogProps> = ({
  open,
  onOpenChange,
  post
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const { createPromotion } = usePromotedPosts();
  const { toast } = useToast();
  const { user } = useAuth();

  // Promotion Configuration State
  const [promotionConfig, setPromotionConfig] = useState<PromotionConfig>({
    goal: 'engagement',
    audience: {
      mode: 'automatic',
      estimatedReach: 5000,
      locations: [],
      ageRange: [18, 24],
      gender: 'all',
      interests: []
    },
    placements: ['main_feed', 'explore'],
    budget: {
      type: 'daily',
      amount: 10,
      duration: 7,
      totalBudget: 70
    },
    metrics: {
      primary: 'cost_per_engagement',
      primaryTarget: 0.15,
      secondary: ['impressions', 'reach', 'ctr', 'frequency'],
      guardrails: {
        frequencyCap: 3,
        negativeFeedbackThreshold: 0.05,
        ctrThreshold: 0.01
      }
    },
    reporting: {
      dailyEmail: true,
      inAppDashboard: true
    }
  });

  // Get user's profile info for audience targeting
  const [userProfile, setUserProfile] = React.useState<{ school?: string; major?: string }>({});

  React.useEffect(() => {
    if (user) {
      // You could fetch this from the profiles table if needed
      // For now, we'll leave it empty
    }
  }, [user]);

  const handleNext = () => {
    // Validation before moving to next step
    if (currentStep === 2 && promotionConfig.audience.mode === 'manual' && promotionConfig.audience.interests.length < 3) {
      toast({
        title: "Add More Interests",
        description: "Please add at least 3 interests for manual targeting",
        variant: "destructive"
      });
      return;
    }

    if (currentStep === 3 && promotionConfig.placements.length === 0) {
      toast({
        title: "Select Placements",
        description: "Please select at least one placement",
        variant: "destructive"
      });
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handlePromote = async () => {
    setProcessing(true);
    try {
      const result = await createPromotion(
        post.id,
        promotionConfig.budget.totalBudget,
        promotionConfig.budget.duration,
        true, // skipPayment = true (for now)
        promotionConfig // Pass full config
      );

      if (result.success) {
        toast({
          title: "Promotion Activated!",
          description: `Your post is now being promoted with a priority score of ${result.priorityScore}/100`
        });
        onOpenChange(false);
        setCurrentStep(1); // Reset for next time
      } else {
        throw new Error(result.error || 'Failed to create promotion');
      }
    } catch (error: any) {
      console.error('Promotion error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create promotion",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;
  const canGoNext = currentStep < STEPS.length;
  const canGoBack = currentStep > 1;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) setCurrentStep(1); // Reset on close
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Promote Your Post
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`${
                  currentStep === step.id ? 'text-primary font-medium' : ''
                } ${currentStep > step.id ? 'text-muted-foreground' : ''}`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-4">
          {currentStep === 1 && (
            <GoalStep
              selectedGoal={promotionConfig.goal}
              onGoalChange={(goal) => setPromotionConfig({ ...promotionConfig, goal })}
            />
          )}

          {currentStep === 2 && (
            <AudienceStep
              audience={promotionConfig.audience}
              onAudienceChange={(audience) => setPromotionConfig({ ...promotionConfig, audience })}
              userSchool={userProfile.school}
              userMajor={userProfile.major}
            />
          )}

          {currentStep === 3 && (
            <PlacementsStep
              selectedPlacements={promotionConfig.placements}
              onPlacementsChange={(placements) => setPromotionConfig({ ...promotionConfig, placements })}
              hasImage={!!post.image_url}
            />
          )}

          {currentStep === 4 && (
            <BudgetStep
              budget={promotionConfig.budget}
              onBudgetChange={(budget) => setPromotionConfig({ ...promotionConfig, budget })}
            />
          )}

          {currentStep === 5 && (
            <EligibilityStep post={post} />
          )}

          {currentStep === 6 && (
            <ReviewStep
              goal={promotionConfig.goal}
              audience={promotionConfig.audience}
              placements={promotionConfig.placements}
              budget={promotionConfig.budget}
              post={post}
            />
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={!canGoBack || processing}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={processing}>
              Cancel
            </Button>

            {canGoNext ? (
              <Button onClick={handleNext} disabled={processing}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handlePromote} disabled={processing}>
                {processing ? 'Activating...' : 'Activate Promotion'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
