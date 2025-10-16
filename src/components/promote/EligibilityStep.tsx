import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
}

interface EligibilityStepProps {
  post: Post;
}

interface EligibilityCheck {
  passed: boolean;
  message: string;
  type: 'success' | 'warning' | 'error';
}

const RESTRICTED_KEYWORDS = ['sale', 'buy now', 'limited time', 'urgent', 'click here'];
const SPECIAL_AD_KEYWORDS = ['loan', 'credit', 'mortgage', 'job', 'hiring', 'vote', 'election'];

const checkContentLength = (content: string): EligibilityCheck => {
  if (content.length <= 280) {
    return { passed: true, message: 'Content length optimal', type: 'success' };
  }
  return { passed: true, message: 'Long text may truncate on mobile', type: 'warning' };
};

const checkRestrictedTerms = (content: string): EligibilityCheck => {
  const found = RESTRICTED_KEYWORDS.some(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
  if (!found) {
    return { passed: true, message: 'No restricted terms detected', type: 'success' };
  }
  return { passed: true, message: 'Content may trigger additional review', type: 'warning' };
};

const checkImageFormat = (hasImage: boolean): EligibilityCheck => {
  if (!hasImage) {
    return { passed: true, message: 'Text-only post', type: 'success' };
  }
  return { passed: true, message: 'Image format supported', type: 'success' };
};

const checkSpecialCategory = (content: string): { isSpecial: boolean; category?: string } => {
  const lowerContent = content.toLowerCase();
  if (lowerContent.match(/\b(loan|credit|mortgage|debt)\b/)) {
    return { isSpecial: true, category: 'Credit, employment, or housing' };
  }
  if (lowerContent.match(/\b(job|hiring|career|employment)\b/)) {
    return { isSpecial: true, category: 'Credit, employment, or housing' };
  }
  if (lowerContent.match(/\b(vote|election|campaign|politics)\b/)) {
    return { isSpecial: true, category: 'Politics or social issues' };
  }
  return { isSpecial: false };
};

export const EligibilityStep: React.FC<EligibilityStepProps> = ({ post }) => {
  const contentLengthCheck = checkContentLength(post.content);
  const restrictedTermsCheck = checkRestrictedTerms(post.content);
  const imageFormatCheck = checkImageFormat(!!post.image_url);
  const specialCategory = checkSpecialCategory(post.content);

  const checks = [contentLengthCheck, restrictedTermsCheck, imageFormatCheck];
  const allPassed = checks.every(check => check.passed);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Post Eligibility Check</h3>
        <p className="text-sm text-muted-foreground">Ensuring your post meets promotion guidelines</p>
      </div>

      {/* Eligibility Checks */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          {checks.map((check, index) => (
            <div key={index} className="flex items-center gap-3">
              {getIcon(check.type)}
              <span className="text-sm">{check.message}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Special Ad Category */}
      {specialCategory.isSpecial && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-sm">Special Ad Category Detected</p>
              <p className="text-xs text-muted-foreground">
                This post may be about <strong>{specialCategory.category}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Special categories have limited targeting options:
              </p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>Cannot target by age, gender, or interests</li>
                <li>Only school-based targeting allowed</li>
                <li>May require additional verification</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Guidelines Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-semibold">Promotion Guidelines:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✓ Content must follow community guidelines</li>
            <li>✓ No misleading claims or false information</li>
            <li>✓ No prohibited content (violence, hate speech, etc.)</li>
            <li>✓ Images should be high quality and appropriate</li>
            <li>✓ No excessive caps lock or emojis</li>
          </ul>
        </CardContent>
      </Card>

      {/* Post Preview */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Post Preview</Label>
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
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{post.content.length} characters</span>
              {post.image_url && <span>• Has image</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {allPassed ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
          <p className="font-medium text-green-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Post is eligible for promotion!
          </p>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm">
          <p className="font-medium text-amber-600">
            Please review warnings before proceeding
          </p>
        </div>
      )}
    </div>
  );
};
