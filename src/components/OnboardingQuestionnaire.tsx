import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Music, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  field: string;
  type: 'radio' | 'checkbox' | 'text' | 'textarea';
  options?: string[];
}

const MUSIC_GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Country', 'Electronic', 'Jazz', 
  'Classical', 'Indie', 'Metal', 'Folk', 'Latin', 'K-Pop', 'Other'
];

const QUESTION_POOL: Question[] = [
  {
    id: 'year',
    text: 'What year are you in?',
    field: 'year_in_school',
    type: 'radio',
    options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other']
  },
  {
    id: 'hangout',
    text: 'Where do you usually hang out or study on campus?',
    field: 'campus_hangout_spots',
    type: 'checkbox',
    options: ['Library', 'Student Union', 'Coffee Shop', 'Dorm', 'Outdoor Spaces', 'Study Rooms', 'Gym', 'Other']
  },
  {
    id: 'clubs',
    text: 'Do you go to any campus clubs or events?',
    field: 'clubs_and_events',
    type: 'checkbox',
    options: ['Sports Clubs', 'Academic Clubs', 'Cultural Orgs', 'Greek Life', 'Volunteer Groups', 'Arts/Music', 'Gaming/Tech', 'Other']
  },
  {
    id: 'passion',
    text: "What's something you're passionate about outside school?",
    field: 'passion_outside_school',
    type: 'textarea',
    options: []
  },
  {
    id: 'school_decision',
    text: 'How did you decide to come here for school?',
    field: 'reason_for_school',
    type: 'textarea',
    options: []
  }
];

interface OnboardingQuestionnaireProps {
  onComplete: () => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({
    music_preference: '',
    music_genres: [],
    year_in_school: '',
    campus_hangout_spots: [],
    clubs_and_events: [],
    passion_outside_school: '',
    reason_for_school: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Select 3 random questions on mount
    const shuffled = [...QUESTION_POOL].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    setSelectedQuestions(selected);
  }, []);

  const totalSteps = 4; // Music + 3 random questions
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep === 0 && !answers.music_preference) {
      toast.error('Please select a music preference');
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Prepare the data
      const questionsAsked = selectedQuestions.map(q => q.id);
      const interestData: any = {
        user_id: user.id,
        music_preference: answers.music_preference,
        music_genres: answers.music_genres,
        questions_asked: questionsAsked,
        onboarding_completed: true,
        completed_at: new Date().toISOString()
      };

      // Add answers for the selected questions
      selectedQuestions.forEach(q => {
        if (answers[q.field]) {
          interestData[q.field] = answers[q.field];
        }
      });

      // Insert user interests
      const { error: interestsError } = await supabase
        .from('user_interests')
        .insert(interestData);

      if (interestsError) throw interestsError;

      // Update profile onboarding status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast.success('Welcome! Your profile is complete');
      onComplete();
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('Failed to save your answers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    setAnswers(prev => {
      const currentValues = prev[field] || [];
      if (checked) {
        return { ...prev, [field]: [...currentValues, value] };
      } else {
        return { ...prev, [field]: currentValues.filter((v: string) => v !== value) };
      }
    });
  };

  const renderMusicQuestion = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Music className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold">What kind of music are you into?</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label>Your favorite genre</Label>
          <RadioGroup
            value={answers.music_preference}
            onValueChange={(value) => setAnswers(prev => ({ ...prev, music_preference: value }))}
            className="grid grid-cols-2 gap-3 mt-2"
          >
            {MUSIC_GENRES.map(genre => (
              <div key={genre} className="flex items-center space-x-2">
                <RadioGroupItem value={genre} id={`music-${genre}`} />
                <Label htmlFor={`music-${genre}`} className="cursor-pointer">{genre}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {answers.music_preference && (
          <div>
            <Label>Select all genres you enjoy (optional)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {MUSIC_GENRES.filter(g => g !== answers.music_preference).map(genre => (
                <div key={genre} className="flex items-center space-x-2">
                  <Checkbox
                    id={`genre-${genre}`}
                    checked={answers.music_genres?.includes(genre)}
                    onCheckedChange={(checked) => handleCheckboxChange('music_genres', genre, checked as boolean)}
                  />
                  <Label htmlFor={`genre-${genre}`} className="cursor-pointer">{genre}</Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'radio':
        return (
          <RadioGroup
            value={answers[question.field]}
            onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.field]: value }))}
            className="grid grid-cols-2 gap-3"
          >
            {question.options?.map(option => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label htmlFor={`${question.id}-${option}`} className="cursor-pointer">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="grid grid-cols-2 gap-3">
            {question.options?.map(option => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${option}`}
                  checked={answers[question.field]?.includes(option)}
                  onCheckedChange={(checked) => handleCheckboxChange(question.field, option, checked as boolean)}
                />
                <Label htmlFor={`${question.id}-${option}`} className="cursor-pointer">{option}</Label>
              </div>
            ))}
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={answers[question.field] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
            placeholder="Share your thoughts..."
            className="min-h-[120px]"
            maxLength={200}
          />
        );

      case 'text':
        return (
          <Input
            value={answers[question.field] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
            placeholder="Your answer..."
          />
        );

      default:
        return null;
    }
  };

  if (selectedQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading questions...</div>
      </div>
    );
  }

  const currentQuestion = currentStep === 0 ? null : selectedQuestions[currentStep - 1];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Welcome to PlanVerse!</CardTitle>
          </div>
          <CardDescription>
            Help us connect you with people who share your interests ({currentStep + 1} of {totalSteps})
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep === 0 ? renderMusicQuestion() : (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{currentQuestion?.text}</h3>
              {currentQuestion && renderQuestion(currentQuestion)}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
            >
              {currentStep === totalSteps - 1 ? (
                loading ? 'Saving...' : 'Complete'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
