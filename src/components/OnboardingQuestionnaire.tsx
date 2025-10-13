import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Music, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import planverseLogo from '@/assets/planverse-logo-onboarding.png';

interface Question {
  id: string;
  text: string;
  field: string;
  type: 'text' | 'textarea';
  placeholder?: string;
}

const QUESTION_POOL: Question[] = [
  {
    id: 'year',
    text: 'What year are you in school?',
    field: 'year_in_school',
    type: 'text',
    placeholder: 'e.g., Freshman, Sophomore, Junior, Senior, Graduate...'
  },
  {
    id: 'hangout',
    text: 'Where do you usually hang out or study on campus?',
    field: 'campus_hangout_spots',
    type: 'text',
    placeholder: 'e.g., Library, Student Union, Coffee Shop...'
  },
  {
    id: 'clubs',
    text: 'What campus clubs or events do you attend?',
    field: 'clubs_and_events',
    type: 'text',
    placeholder: 'e.g., Sports Clubs, Academic Clubs, Greek Life...'
  },
  {
    id: 'passion',
    text: "What's something you're passionate about outside school?",
    field: 'passion_outside_school',
    type: 'textarea',
    placeholder: 'Share your interests and hobbies...'
  },
  {
    id: 'school_decision',
    text: 'How did you decide to go to your college?',
    field: 'reason_for_school',
    type: 'textarea',
    placeholder: 'Tell us what brought you here...'
  }
];

interface OnboardingQuestionnaireProps {
  onComplete: () => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({
    favorite_artist: '',
    year_in_school: '',
    campus_hangout_spots: '',
    clubs_and_events: '',
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
    if (currentStep === 0 && !answers.favorite_artist?.trim()) {
      toast.error('Please enter your favorite artist');
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
        music_preference: answers.favorite_artist,
        music_genres: [],
        questions_asked: questionsAsked,
        onboarding_completed: true,
        completed_at: new Date().toISOString()
      };

      // Add answers for the selected questions (convert to arrays for multi-value fields)
      selectedQuestions.forEach(q => {
        if (answers[q.field]) {
          // For hangout spots and clubs, convert comma-separated string to array
          if (q.field === 'campus_hangout_spots' || q.field === 'clubs_and_events') {
            interestData[q.field] = answers[q.field].split(',').map((item: string) => item.trim()).filter(Boolean);
          } else {
            interestData[q.field] = answers[q.field];
          }
        }
      });

      // Insert user interests
      const { error: interestsError } = await supabase
        .from('user_interests')
        .insert(interestData);

      if (interestsError) throw interestsError;

      // Update profile onboarding status and set to public
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          is_public: true
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

  const renderMusicQuestion = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="relative">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h3 className="text-3xl font-bold text-foreground">Who is your favorite artist?</h3>
            <p className="text-sm text-muted-foreground mt-1">🎵 Let's start with music!</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <Label htmlFor="favorite-artist" className="text-base font-semibold">Artist Name</Label>
        <Input
          id="favorite-artist"
          value={answers.favorite_artist || ''}
          onChange={(e) => setAnswers(prev => ({ ...prev, favorite_artist: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleNext();
            }
          }}
          placeholder="e.g., Taylor Swift, Drake, The Beatles..."
          className="text-lg h-16 border-2 transition-all duration-300 hover:border-primary focus:ring-4 focus:ring-primary/20 focus:border-primary shadow-sm hover:shadow-lg"
          maxLength={100}
        />
        <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground">
            Tell us who you love listening to! This helps us connect you with people who share your music taste.
          </p>
        </div>
      </div>
    </div>
  );

  const renderQuestion = (question: Question) => {
    if (question.type === 'textarea') {
      return (
        <div className="space-y-2 animate-fade-in">
          <Textarea
            value={answers[question.field] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleNext();
              }
            }}
            placeholder={question.placeholder || 'Your answer...'}
            className="min-h-[140px] text-base border-2 transition-all duration-300 hover:border-primary focus:ring-4 focus:ring-primary/20 focus:border-primary shadow-sm hover:shadow-lg resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground italic flex items-center gap-1">
            💡 Press <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Enter</kbd> to continue
          </p>
        </div>
      );
    }

    return (
      <Input
        value={answers[question.field] || ''}
        onChange={(e) => setAnswers(prev => ({ ...prev, [question.field]: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleNext();
          }
        }}
        placeholder={question.placeholder || 'Your answer...'}
        className="text-lg h-16 border-2 transition-all duration-300 hover:border-primary focus:ring-4 focus:ring-primary/20 focus:border-primary shadow-sm hover:shadow-lg animate-fade-in"
        maxLength={200}
      />
    );
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
    <div className="fixed inset-0 bg-background/98 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-2 border-primary/20 animate-scale-in hover:shadow-primary/20 transition-all duration-300">
        <CardHeader className="space-y-6 pb-8 bg-primary/5 border-b-4 border-primary">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src={planverseLogo} alt="PlanVerse" className="w-16 h-16 object-contain animate-float" />
            </div>
            <div>
              <CardTitle className="text-4xl font-bold text-foreground">
                Welcome to planverse
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Help us connect you with people who share your interests
              </CardDescription>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Question {currentStep + 1} of {totalSteps}</span>
            </div>
            <Progress value={progress} className="h-3 shadow-inner" />
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pt-8 pb-8">
          {currentStep === 0 ? renderMusicQuestion() : (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-start gap-4 p-4 bg-accent/10 border-l-4 border-accent rounded-r-xl">
                <h3 className="text-2xl font-bold leading-tight text-foreground">{currentQuestion?.text}</h3>
              </div>
              {currentQuestion && renderQuestion(currentQuestion)}
            </div>
          )}

          <div className="flex justify-between pt-8 border-t-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-6 h-12 border-2 transition-all duration-300 hover:scale-105 hover:border-primary hover:text-primary disabled:opacity-50 disabled:hover:scale-100 shadow-sm"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="px-8 h-12 bg-primary hover:bg-primary/90 text-white transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg disabled:opacity-50"
            >
              {currentStep === totalSteps - 1 ? (
                loading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete
                    <Sparkles className="h-5 w-5 ml-2" />
                  </>
                )
              ) : (
                <>
                  Next
                  <ChevronRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
