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

  const renderMusicQuestion = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(to bottom right, rgba(17, 150, 239, 0.2), rgba(251, 214, 76, 0.2))' }}>
          <Music className="h-7 w-7 text-[#1196ef] animate-pulse" />
        </div>
        <h3 className="text-2xl font-bold" style={{ background: 'linear-gradient(to right, #1196ef, #fbd64c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Who is your favorite artist?
        </h3>
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
          className="text-lg h-14 transition-all duration-300 hover:border-primary/50 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:scale-[1.01] shadow-sm hover:shadow-md"
          maxLength={100}
        />
        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-4 w-4 mt-0.5 text-[#1196ef] flex-shrink-0" />
          Tell us who you love listening to! This helps us connect you with people who share your music taste.
        </p>
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
            className="min-h-[140px] text-base transition-all duration-300 hover:border-primary/50 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:scale-[1.01] shadow-sm hover:shadow-md resize-none"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground italic">💡 Press Ctrl+Enter (or Cmd+Enter) to continue</p>
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
        className="text-lg h-14 transition-all duration-300 hover:border-primary/50 focus:ring-2 focus:ring-primary/30 focus:border-primary focus:scale-[1.01] shadow-sm hover:shadow-md animate-fade-in"
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
    <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom right, hsl(var(--background)), rgba(17, 150, 239, 0.05), rgba(251, 214, 76, 0.05))' }}>
      <Card className="w-full max-w-2xl shadow-2xl border-2 animate-scale-in hover:shadow-primary/10 transition-shadow duration-300">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg shadow-lg" style={{ background: 'linear-gradient(to bottom right, #1196ef, #fbd64c)' }}>
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold" style={{ background: 'linear-gradient(to right, #1196ef, #1196ef, #fbd64c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Welcome to PlanVerse!
            </CardTitle>
          </div>
          <CardDescription className="text-base">
            Help us connect you with people who share your interests ({currentStep + 1} of {totalSteps})
          </CardDescription>
          <div className="relative">
            <Progress value={progress} className="mt-2 h-3 bg-muted/50" />
            <div className="absolute inset-0 rounded-full blur-sm -z-10" style={{ background: 'linear-gradient(to right, rgba(17, 150, 239, 0.2), rgba(251, 214, 76, 0.2))' }} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {currentStep === 0 ? renderMusicQuestion() : (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg mt-1" style={{ background: 'linear-gradient(to bottom right, rgba(17, 150, 239, 0.1), rgba(251, 214, 76, 0.1))' }}>
                  <Music className="h-5 w-5 text-[#1196ef]" />
                </div>
                <h3 className="text-2xl font-bold leading-tight">{currentQuestion?.text}</h3>
              </div>
              {currentQuestion && renderQuestion(currentQuestion)}
            </div>
          )}

          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="transition-all duration-300 hover:scale-105 hover:border-primary/50 disabled:opacity-50 disabled:hover:scale-100"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={loading}
              className="text-white hover:opacity-90 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              style={{ background: 'linear-gradient(to right, #1196ef, #fbd64c)' }}
            >
              {currentStep === totalSteps - 1 ? (
                loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Complete
                  </>
                )
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
