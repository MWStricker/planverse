import { useState } from 'react';
import { Building2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface AccountTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (accountType: 'professional_business' | 'professional_creator') => Promise<void>;
}

export const AccountTypeDialog = ({ open, onClose, onConfirm }: AccountTypeDialogProps) => {
  const [selectedType, setSelectedType] = useState<'professional_business' | 'professional_creator' | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedType) return;
    
    setIsLoading(true);
    try {
      await onConfirm(selectedType);
      setStep('select');
      setSelectedType(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Your Professional Account Type</DialogTitle>
              <DialogDescription>
                Select the type that best describes your account purpose
              </DialogDescription>
            </DialogHeader>
            
            <RadioGroup 
              value={selectedType || ''} 
              onValueChange={(val) => setSelectedType(val as 'professional_business' | 'professional_creator')}
              className="space-y-4"
            >
              <Card 
                className={cn(
                  "cursor-pointer transition-all",
                  selectedType === 'professional_business' && "border-primary ring-2 ring-primary"
                )}
                onClick={() => setSelectedType('professional_business')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <RadioGroupItem value="professional_business" id="business" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <Label htmlFor="business" className="text-lg font-semibold cursor-pointer">
                          Business / Organization
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Perfect for student clubs, campus businesses, event organizers, and university services
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Promote events and announcements</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Track engagement from different majors</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Analytics dashboard for campaigns</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Professional badge on posts</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={cn(
                  "cursor-pointer transition-all",
                  selectedType === 'professional_creator' && "border-primary ring-2 ring-primary"
                )}
                onClick={() => setSelectedType('professional_creator')}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <RadioGroupItem value="professional_creator" id="creator" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <Label htmlFor="creator" className="text-lg font-semibold cursor-pointer">
                          Content Creator
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Ideal for influencers, artists, educators, and personal brands
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Boost your content reach</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Detailed post performance metrics</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Audience demographics insights</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Creator badge on profile</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                onClick={() => setStep('confirm')} 
                disabled={!selectedType}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}
        
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Account Upgrade</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  You're upgrading to a <strong>Professional {selectedType === 'professional_business' ? 'Business' : 'Creator'}</strong> account
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2 text-sm">
                <p className="font-semibold">What happens next:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                  <li>Analytics tab will appear in your navigation</li>
                  <li>You can promote posts to reach more students</li>
                  <li>A professional badge will be added to your profile</li>
                  <li>You can switch back to personal anytime</li>
                </ul>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button onClick={handleConfirm} disabled={isLoading}>
                {isLoading ? 'Upgrading...' : 'Upgrade to Professional'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};