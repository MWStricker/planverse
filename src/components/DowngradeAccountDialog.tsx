import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DowngradeAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  currentAccountType: string;
}

export const DowngradeAccountDialog = ({ open, onClose, onConfirm, currentAccountType }: DowngradeAccountDialogProps) => {
  const [confirmations, setConfirmations] = useState({
    loseAnalytics: false,
    pausePromotions: false,
    understandRevert: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const allConfirmed = Object.values(confirmations).every(Boolean);

  const handleConfirm = async () => {
    if (!allConfirmed) return;
    
    setIsLoading(true);
    try {
      await onConfirm();
      setConfirmations({
        loseAnalytics: false,
        pausePromotions: false,
        understandRevert: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmations({
      loseAnalytics: false,
      pausePromotions: false,
      understandRevert: false,
    });
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Switch to Personal Account?</DialogTitle>
          <DialogDescription>
            You're about to downgrade from Professional {currentAccountType === 'professional_business' ? 'Business' : 'Creator'} to a Personal account
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please review what will happen when you switch to a personal account
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox 
                id="analytics"
                checked={confirmations.loseAnalytics}
                onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, loseAnalytics: !!checked }))}
              />
              <label htmlFor="analytics" className="text-sm leading-tight cursor-pointer">
                I understand I will <strong>lose access to the Analytics dashboard</strong> and won't be able to view post performance metrics
              </label>
            </div>
            
            <div className="flex items-start gap-3">
              <Checkbox 
                id="promotions"
                checked={confirmations.pausePromotions}
                onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, pausePromotions: !!checked }))}
              />
              <label htmlFor="promotions" className="text-sm leading-tight cursor-pointer">
                I understand that <strong>any active promoted posts will be paused</strong> and I won't be able to create new promotions
              </label>
            </div>
            
            <div className="flex items-start gap-3">
              <Checkbox 
                id="revert"
                checked={confirmations.understandRevert}
                onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, understandRevert: !!checked }))}
              />
              <label htmlFor="revert" className="text-sm leading-tight cursor-pointer">
                I understand I can <strong>upgrade back to professional</strong> at any time and my historical data will be preserved
              </label>
            </div>
          </div>
          
          <Alert>
            <AlertDescription>
              <strong>What you'll keep:</strong> All your posts, connections, and profile data remain unchanged. Only professional features will be disabled.
            </AlertDescription>
          </Alert>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button 
            variant="destructive"
            onClick={handleConfirm}
            disabled={!allConfirmed || isLoading}
          >
            {isLoading ? 'Switching...' : 'Switch to Personal Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};