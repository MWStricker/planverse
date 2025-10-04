import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import planverseLogo from "@/assets/planverse-logo-final.png";



const Auth = () => {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [phoneValid, setPhoneValid] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState(3);
  const [isTyping, setIsTyping] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Phone validation (basic international format)
  const validatePhone = (phone: string) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
  };

  // Password strength calculation
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  // Handle email change with validation
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailValid(validateEmail(value));
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1000);
  };

  // Handle phone change with validation
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
    setPhoneValid(validatePhone(value));
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1000);
  };

  // Handle password change with strength calculation
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 1000);
  };

  useEffect(() => {
    // Only listen for auth state changes, don't auto-redirect on page load
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change in Auth page:', event, session?.user?.email);
      
      // Only redirect on successful sign-in events, not on page load or other events
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        console.log('User signed in via auth event, redirecting to dashboard...');
        navigate("/");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (authMethod === 'email') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (error) {
          if (error.message.includes("already registered")) {
            setError("An account with this email already exists. Please sign in instead.");
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account.",
          });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          phone,
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          toast({
            title: "Verification code sent!",
            description: "Please check your phone for the verification code.",
          });
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (authMethod === 'email') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Invalid email or password. Please check your credentials and try again.");
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You have been signed in successfully.",
          });
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          phone,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setError("Invalid phone or password. Please check your credentials and try again.");
          } else {
            setError(error.message);
          }
        } else {
          toast({
            title: "Welcome back!",
            description: "You have been signed in successfully.",
          });
          navigate("/");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      console.log('Starting Google OAuth flow with full calendar access...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'email profile openid https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
        },
      });

      console.log('Google OAuth response:', { data, error });

      if (error) {
        console.error('Google OAuth error:', error);
        setError(`Google sign-in failed: ${error.message}`);
      } else {
        console.log('Google OAuth initiated successfully with calendar scopes');
        // The redirect will happen automatically
      }
    } catch (err) {
      console.error('Unexpected Google OAuth error:', err);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      console.log('Starting Microsoft OAuth flow...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email',
          redirectTo: `${window.location.origin}/`,
        },
      });

      console.log('Microsoft OAuth response:', { data, error });

      if (error) {
        console.error('Microsoft OAuth error:', error);
        setError(`Microsoft sign-in failed: ${error.message}`);
      } else {
        console.log('Microsoft OAuth initiated successfully');
        // The redirect will happen automatically
      }
    } catch (err) {
      console.error('Unexpected Microsoft OAuth error:', err);
      setError("Failed to sign in with Microsoft. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="mx-auto w-32 h-32 flex items-center justify-center mb-6">
            <img src={planverseLogo} alt="Planverse" className="w-28 h-28 object-contain" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent mb-3">
            Welcome to Planverse
          </h1>
          <p className="text-muted-foreground text-lg">All your resources in one place!</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm animate-scale-in">
          <CardContent className="p-8">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl mb-8">
                <TabsTrigger 
                  value="signin" 
                  className="rounded-lg font-medium transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-lg font-medium transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="mt-0">
                {/* Auth Method Toggle */}
                <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-muted/30 rounded-xl">
                  <Button
                    type="button"
                    variant={authMethod === 'email' ? 'default' : 'ghost'}
                    onClick={() => setAuthMethod('email')}
                    className="rounded-lg"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={authMethod === 'phone' ? 'default' : 'ghost'}
                    onClick={() => setAuthMethod('phone')}
                    className="rounded-lg"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Phone
                  </Button>
                </div>

                <form onSubmit={handleSignIn} className="space-y-6" autoComplete="off">
                  <input autoComplete="false" name="hidden" type="text" style={{display:'none'}} />
                  <input type="password" autoComplete="new-password" style={{display:'none'}} />
                  
                  {authMethod === 'email' ? (
                    <div className="space-y-3">
                      <Label htmlFor="signin-email" className="text-sm font-semibold text-foreground/90">
                        Email Address
                      </Label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                          emailValid ? 'text-green-500' : isTyping ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={handleEmailChange}
                          required
                          className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                        />
                        {email && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {emailValid ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-orange-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label htmlFor="signin-phone" className="text-sm font-semibold text-foreground/90">
                        Phone Number
                      </Label>
                      <div className="relative group">
                        <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                          phoneValid ? 'text-green-500' : isTyping ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="signin-phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phone}
                          onChange={handlePhoneChange}
                          required
                          className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                        />
                        {phone && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {phoneValid ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-orange-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Label htmlFor="signin-password" className="text-sm font-semibold text-foreground/90">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                        isTyping ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  
                  {error && (
                    <Alert variant="destructive" className="animate-fade-in rounded-xl border-2">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary/95 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group" 
                    disabled={loading || (authMethod === 'email' ? !emailValid : !phoneValid)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    {loading ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        <span className="animate-pulse">Signing In...</span>
                      </>
                    ) : (
                      <>
                        <User className="mr-3 h-5 w-5 transition-transform group-hover:scale-110" />
                        <span>Sign In</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-0">
                {/* Auth Method Toggle */}
                <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-muted/30 rounded-xl">
                  <Button
                    type="button"
                    variant={authMethod === 'email' ? 'default' : 'ghost'}
                    onClick={() => setAuthMethod('email')}
                    className="rounded-lg"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={authMethod === 'phone' ? 'default' : 'ghost'}
                    onClick={() => setAuthMethod('phone')}
                    className="rounded-lg"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Phone
                  </Button>
                </div>

                <form onSubmit={handleSignUp} className="space-y-6" autoComplete="off">
                  <input autoComplete="false" name="hidden" type="text" style={{display:'none'}} />
                  <input type="password" autoComplete="new-password" style={{display:'none'}} />
                  
                  {authMethod === 'email' ? (
                    <div className="space-y-3">
                      <Label htmlFor="signup-email" className="text-sm font-semibold text-foreground/90">
                        Email Address
                      </Label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                          emailValid ? 'text-green-500' : isTyping ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={handleEmailChange}
                          required
                          className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                        />
                        {email && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {emailValid ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-orange-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Label htmlFor="signup-phone" className="text-sm font-semibold text-foreground/90">
                        Phone Number
                      </Label>
                      <div className="relative group">
                        <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                          phoneValid ? 'text-green-500' : isTyping ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phone}
                          onChange={handlePhoneChange}
                          required
                          className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                        />
                        {phone && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {phoneValid ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-orange-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <Label htmlFor="signup-password" className="text-sm font-semibold text-foreground/90">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                        isTyping ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        minLength={6}
                        className="pl-12 pr-12 h-12 text-base border-2 transition-all duration-200 focus:ring-2 focus:ring-primary/20 group-hover:border-primary/30 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {password && (
                      <div className="space-y-3 animate-fade-in p-4 bg-muted/30 rounded-xl">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground/80">Password strength</span>
                          <span className={`font-semibold ${
                            passwordStrength >= 4 ? 'text-green-600' : 
                            passwordStrength >= 3 ? 'text-yellow-600' : 
                            passwordStrength >= 2 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {passwordStrength >= 4 ? 'Strong' : 
                             passwordStrength >= 3 ? 'Good' : 
                             passwordStrength >= 2 ? 'Fair' : 'Weak'}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                i < passwordStrength
                                  ? passwordStrength >= 4 ? 'bg-green-500' : 
                                    passwordStrength >= 3 ? 'bg-yellow-500' : 
                                    passwordStrength >= 2 ? 'bg-orange-500' : 'bg-red-500'
                                  : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {error && (
                    <Alert variant="destructive" className="animate-fade-in rounded-xl border-2">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-muted disabled:to-muted relative overflow-hidden group text-white" 
                    disabled={loading || (authMethod === 'email' ? !emailValid : !phoneValid) || passwordStrength < 2}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    {loading ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        <span className="animate-pulse">Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <User className="mr-3 h-5 w-5 transition-transform group-hover:scale-110" />
                        <span>Create Account</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-4 text-muted-foreground font-medium">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full mt-6 h-14 text-base font-semibold rounded-xl border-2 transition-all duration-200 hover:bg-muted/50 hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  <span>Google</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMicrosoftSignIn}
                  disabled={loading}
                  className="w-full mt-6 h-14 text-base font-semibold rounded-xl border-2 transition-all duration-200 hover:bg-muted/50 hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M13 1h10v10H13z" />
                      <path fill="#7fba00" d="M1 13h10v10H1z" />
                      <path fill="#ffb900" d="M13 13h10v10H13z" />
                    </svg>
                  )}
                  <span>Microsoft</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>
            By signing up, you agree to our{' '}
            <a 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;