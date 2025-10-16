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
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Eye, Users, DollarSign, Calendar } from 'lucide-react';
import { usePromotedPosts } from '@/hooks/usePromotedPosts';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';

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

const DURATION_OPTIONS = [
  { days: 3, label: '3 Days' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: '30 Days' }
];

const calculatePriorityScore = (budget: number, days: number): number => {
  const budgetScore = Math.min((budget / 500) * 50, 50);
  const durationScore = Math.min((days / 30) * 50, 50);
  return Math.round(budgetScore + durationScore);
};

export const PromotePostDialog: React.FC<PromotePostDialogProps> = ({
  open,
  onOpenChange,
  post
}) => {
  const [budget, setBudget] = useState([50]);
  const [durationDays, setDurationDays] = useState(7);
  const [processing, setProcessing] = useState(false);
  const { createPromotion } = usePromotedPosts();
  const { toast } = useToast();

  // Calculate metrics
  const estimatedImpressions = Math.floor(budget[0] * 100 * (1 + durationDays / 10));
  const costPerDay = (budget[0] / durationDays).toFixed(2);
  const priorityScore = calculatePriorityScore(budget[0], durationDays);

  const handlePromote = async () => {
    setProcessing(true);
    try {
      const result = await createPromotion(post.id, budget[0], durationDays, true); // skipPayment = true

      if (result.success) {
        toast({
          title: "Promotion Activated!",
          description: "Your post is now being promoted and will appear at the top of feeds."
        });
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Promote Your Post
          </DialogTitle>
          <DialogDescription>
            Increase your post's visibility and reach more students
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Post Preview */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {post.image_url && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={post.image_url} 
                    alt="Post preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm">{post.content}</p>
              <Badge variant="outline">
                <TrendingUp className="h-3 w-3 mr-1" />
                Will be promoted
              </Badge>
            </CardContent>
          </Card>

          {/* Budget Slider */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Promotion Budget</Label>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-2xl font-bold">${budget[0]}</span>
              </div>
              <Slider
                value={budget}
                onValueChange={setBudget}
                min={5}
                max={1000}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$5 (Min)</span>
                <span>$1,000 (Max)</span>
              </div>
            </div>
          </div>

          {/* Duration Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Campaign Duration</Label>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  variant={durationDays === option.days ? 'default' : 'outline'}
                  onClick={() => setDurationDays(option.days)}
                  className="w-full"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Estimated Metrics */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6 space-y-4">
              <h4 className="font-semibold text-sm">Estimated Performance</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs">Impressions</span>
                  </div>
                  <p className="text-xl font-bold">{estimatedImpressions.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <p className="text-xl font-bold">{durationDays} days</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">Per Day</span>
                  </div>
                  <p className="text-xl font-bold">${costPerDay}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Priority</span>
                  </div>
                  <p className="text-xl font-bold">{priorityScore}/100</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">How it works:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Your post will appear at the top of feeds based on priority score</li>
              <li>• Higher budget + longer duration = higher priority</li>
              <li>• Track impressions, clicks, and engagement in real-time</li>
              <li>• Promotion will automatically end after the selected duration</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={processing}>
            {processing ? 'Activating...' : 'Skip Payment & Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
