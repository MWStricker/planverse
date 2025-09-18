import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, Eye, Lock, Database, Share } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Privacy Policy</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Privacy Policy
            </CardTitle>
            <CardDescription>
              Last updated: {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                1. Information We Collect
              </h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We collect information you provide directly to us, such as when you:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Create an account and complete your profile</li>
                  <li>Upload academic schedules or documents</li>
                  <li>Post content or interact with other users</li>
                  <li>Contact us for support</li>
                  <li>Connect external services (like Canvas or Google Calendar)</li>
                </ul>
                <p>This includes your name, email address, school information, academic data, and any content you choose to share.</p>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                2. How We Use Your Information
              </h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Process your academic schedule and assignments</li>
                  <li>Enable social features and connections with other students</li>
                  <li>Send you technical notices and support messages</li>
                  <li>Respond to your comments and questions</li>
                  <li>Analyze usage patterns to improve our platform</li>
                </ul>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Share className="h-5 w-5 text-primary" />
                3. Information Sharing and Disclosure
              </h2>
              <div className="space-y-3 text-muted-foreground">
                <p>We may share your information in the following circumstances:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>With other users:</strong> Your profile information and posts are visible to other students on the platform</li>
                  <li><strong>With your consent:</strong> When you explicitly agree to share information</li>
                  <li><strong>For legal reasons:</strong> If required by law or to protect our rights</li>
                  <li><strong>Service providers:</strong> With trusted third parties who help us operate our platform</li>
                  <li><strong>Business transfers:</strong> In connection with mergers or acquisitions</li>
                </ul>
                <p>We do not sell your personal information to third parties.</p>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">4. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">5. Third-Party Integrations</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Our platform integrates with third-party services such as:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Canvas:</strong> To sync your course assignments and schedules</li>
                  <li><strong>Google Calendar:</strong> To integrate with your personal calendar</li>
                  <li><strong>Authentication providers:</strong> For secure login</li>
                </ul>
                <p>These integrations are subject to their respective privacy policies. We only access the minimum data necessary to provide our services.</p>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                6. Your Privacy Rights
              </h2>
              <div className="space-y-3 text-muted-foreground">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Access and update your personal information</li>
                  <li>Delete your account and associated data</li>
                  <li>Control what information is visible to other users</li>
                  <li>Opt out of non-essential communications</li>
                  <li>Request a copy of your data</li>
                  <li>Withdraw consent for data processing where applicable</li>
                </ul>
                <p>You can exercise these rights through your account settings or by contacting us.</p>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide you services. We may retain certain information for legitimate business purposes or as required by law, even after account deletion.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">8. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our service is intended for users who are at least 13 years old. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">9. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">10. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "last updated" date. Your continued use of the service constitutes acceptance of the revised policy.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us through the app or at privacy@planverse.app.
              </p>
            </section>

          </CardContent>
        </Card>
      </main>
    </div>
  );
};