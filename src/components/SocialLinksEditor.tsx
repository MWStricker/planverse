import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Instagram, Ghost, Tv, Github, Twitter, Youtube, Check, X } from 'lucide-react';

interface SocialLinksEditorProps {
  initialLinks?: Record<string, string>;
  onSave: (links: Record<string, string>) => Promise<void>;
}

const platforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username' },
  { id: 'snapchat', label: 'Snapchat', icon: Ghost, placeholder: 'https://snapchat.com/add/username' },
  { id: 'twitch', label: 'Twitch', icon: Tv, placeholder: 'https://twitch.tv/username' },
  { id: 'github', label: 'GitHub', icon: Github, placeholder: 'https://github.com/username' },
  { id: 'twitter', label: 'Twitter/X', icon: Twitter, placeholder: 'https://twitter.com/username' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@username' },
];

const urlPatterns: Record<string, RegExp> = {
  instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/,
  snapchat: /^https?:\/\/(www\.)?snapchat\.com\/add\/[a-zA-Z0-9_.]+\/?$/,
  twitch: /^https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_]+\/?$/,
  github: /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-]+\/?$/,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/,
  youtube: /^https?:\/\/(www\.)?(youtube\.com\/(c\/|channel\/|user\/|@)?[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)\/?$/,
};

const extractUsername = (url: string, platform: string): string | null => {
  const patterns: Record<string, RegExp> = {
    instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/,
    snapchat: /snapchat\.com\/add\/([a-zA-Z0-9_.]+)/,
    twitch: /twitch\.tv\/([a-zA-Z0-9_]+)/,
    github: /github\.com\/([a-zA-Z0-9-]+)/,
    twitter: /(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
    youtube: /youtube\.com\/(c\/|channel\/|user\/|@)?([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+)/,
  };
  
  const match = url.match(patterns[platform]);
  if (!match) return null;
  
  return match[2] || match[1];
};

export const SocialLinksEditor: React.FC<SocialLinksEditorProps> = ({ initialLinks = {}, onSave }) => {
  const [links, setLinks] = useState<Record<string, string>>(initialLinks);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  const handleLinkChange = (platform: string, value: string) => {
    if (value === '') {
      const newLinks = { ...links };
      delete newLinks[platform];
      setLinks(newLinks);
    } else {
      setLinks({ ...links, [platform]: value });
    }
  };

  const isValidUrl = (platform: string, url: string): boolean => {
    if (!url) return true;
    return urlPatterns[platform]?.test(url) || false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const validLinks = Object.fromEntries(
        Object.entries(links).filter(([platform, url]) => url && isValidUrl(platform, url))
      );
      await onSave(validLinks);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = (platform: string) => {
    const newLinks = { ...links };
    delete newLinks[platform];
    setLinks(newLinks);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>
          Add links to your social media profiles. They'll appear as icons on your public profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const url = links[platform.id] || '';
            const isValid = isValidUrl(platform.id, url);
            const username = url && isValid ? extractUsername(url, platform.id) : null;

            return (
              <div key={platform.id} className="space-y-2">
                <Label htmlFor={platform.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {platform.label}
                </Label>
                <div className="relative">
                  <Input
                    id={platform.id}
                    type="url"
                    value={url}
                    onChange={(e) => handleLinkChange(platform.id, e.target.value)}
                    placeholder={platform.placeholder}
                    className={url && !isValid ? 'border-destructive' : ''}
                  />
                  {url && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {isValid ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClear(platform.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {url && isValid && username && (
                  <p className="text-xs text-muted-foreground">
                    Will display as: @{username}
                  </p>
                )}
                {url && !isValid && (
                  <p className="text-xs text-destructive">
                    Invalid URL format
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Social Links'}
        </Button>
      </CardContent>
    </Card>
  );
};
