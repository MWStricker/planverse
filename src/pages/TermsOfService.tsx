import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, Scale, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TermsOfService = () => {
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
              <Scale className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Terms of Service</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Scale className="h-6 w-6 text-primary" />
              Terms of Service
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
                <Shield className="h-5 w-5 text-primary" />
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using Planverse ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Planverse is a student productivity platform that helps you manage your academic schedule, assignments, and connect with fellow students. The service includes calendar integration, task management, social features, and academic planning tools.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">3. User Accounts and Registration</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>To access certain features of the Service, you must register for an account. When you register, you agree to:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and update your information to keep it accurate</li>
                  <li>Keep your password secure and confidential</li>
                  <li>Accept responsibility for all activities under your account</li>
                </ul>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">4. Acceptable Use Policy</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>You agree not to use the Service to:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Violate any laws or regulations</li>
                  <li>Infringe on the rights of others</li>
                  <li>Upload malicious code or spam</li>
                  <li>Harass, bully, or intimidate other users</li>
                  <li>Share inappropriate or offensive content</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                </ul>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">5. Privacy and Data Protection</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information when you use our Service. By using our Service, you agree to the collection and use of information in accordance with our Privacy Policy.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">6. Content and Intellectual Property</h2>
              <div className="space-y-3 text-muted-foreground">
                <p>Regarding content you submit to the Service:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>You retain ownership of your content</li>
                  <li>You grant us a license to use, display, and distribute your content as part of the Service</li>
                  <li>You are responsible for ensuring you have the right to share any content you upload</li>
                  <li>We reserve the right to remove content that violates our terms</li>
                </ul>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">7. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain high availability of our Service, but we do not guarantee uninterrupted access. We may temporarily suspend the Service for maintenance, updates, or unforeseen technical issues.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by law, Planverse shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users of the Service, us, or third parties.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Service on this page and updating the "last updated" date.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-3">11. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us through the app or at support@planverse.app.
              </p>
            </section>

          </CardContent>
        </Card>
      </main>
    </div>
  );
};