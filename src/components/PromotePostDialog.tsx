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

interface PromotePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postContent: string;
}

const DURATION_OPTIONS = [
  { days: 3, label: '3 Days' },
  { days: 7, label: '7 Days' },
  { days: 14, label: '14 Days' },
  { days: 30, label: '30 Days' }
];

export const PromotePostDialog: React.FC<PromotePostDialogProps> = ({
  open,
  onOpenChange,
  postId,
  postContent
}) => {
  const [budget, setBudget] = useState([25]);
  const [durationDays, setDurationDays] = useState(7);
  const [processing, setProcessing] = useState(false);
  const { createPromotion } = usePromotedPosts();
  const { toast } = useToast();

  // Estimate impressions based on budget
  const estimatedImpressions = Math.floor(budget[0] * 100 * (1 + durationDays / 10));
  const costPerDay = (budget[0] / durationDays).toFixed(2);

  const handlePromote = async () => {
    setProcessing(true);
    try {
      const result = await createPromotion(postId, budget[0], durationDays);

      if (result.success && result.clientSecret) {
        toast({
          title: "Promotion Created",
          description: "Redirecting to payment..."
        });

        // Load Stripe and redirect to checkout
        const stripe = await loadStripe(
          'pk_test_51QU72yJhE1wqjfF4LF7iI6nwu0GqYb8fN1O8VIxVLgSzFRzp1vBZoFtjdG9xdNvKmQQQ2xGgKJPLWLNRa8L7ZJPY00YrzZ0Jz4'
        );

        if (stripe) {
          // For now, show success message - actual Stripe integration will be added
          toast({
            title: "Promotion Pending",
            description: "Your promotion is pending moderator approval. You'll be notified once it's approved."
          });
          onOpenChange(false);
        }
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
            <CardContent className="pt-6">
              <p className="text-sm line-clamp-3">{postContent}</p>
              <Badge variant="outline" className="mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                Promoted
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
              <div className="grid grid-cols-3 gap-4">
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
              </div>
            </CardContent>
          </Card>

          {/* Important Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Before you promote:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• All promoted posts require moderator approval</li>
              <li>• You'll be notified once your promotion is approved</li>
              <li>• Full refund if promotion is rejected</li>
              <li>• Analytics will be available once promotion starts</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={processing}>
            {processing ? 'Processing...' : `Pay $${budget[0]} & Promote`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
