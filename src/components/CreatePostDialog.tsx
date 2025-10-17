import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccessibleDropdown, AccessibleDropdownItem } from '@/components/ui/accessible-dropdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Hash, 
  Users, 
  GraduationCap, 
  Globe, 
  Lock, 
  School,
  X,
  Plus
} from 'lucide-react';
import { collegeMajors } from '@/data/collegeMajors';
import { universities } from '@/data/universities';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fileToDataURL } from '@/lib/utils';

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePost: (postData: {
    content: string;
    imageUrl?: string;
    targetMajor?: string;
    targetCommunity?: string;
    postType: string;
    visibility: string;
    tags: string[];
  }) => Promise<boolean>;
}

const POST_TYPES = [
  { value: 'general', label: 'General', icon: Globe },
  { value: 'academic', label: 'Academic', icon: GraduationCap },
  { value: 'social', label: 'Social', icon: Users },
  { value: 'announcement', label: 'Announcement', icon: Hash },
  { value: 'question', label: 'Question', icon: Hash },
  { value: 'study-group', label: 'Study Group', icon: Users },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Everyone can see', icon: Globe },
  { value: 'school-only', label: 'School Only', description: 'Only your school', icon: School },
  { value: 'major-only', label: 'Major Only', description: 'Only your major', icon: GraduationCap },
  { value: 'friends-only', label: 'Friends Only', description: 'Only your friends', icon: Lock },
];

export const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  open,
  onOpenChange,
  onCreatePost
}) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [visibility, setVisibility] = useState('public');
  const [targetMajor, setTargetMajor] = useState('all-majors');
  const [targetCommunity, setTargetCommunity] = useState('all-schools');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Update defaults when profile loads
  React.useEffect(() => {
    if (profile?.major) {
      setTargetMajor(profile.major);
    }
    if (profile?.school) {
      setTargetCommunity(profile.school);
    }
  }, [profile]);

  const resetForm = () => {
    setContent('');
    setPostType('general');
    setVisibility('public');
    setTargetMajor(profile?.major || 'all-majors');
    setTargetCommunity(profile?.school || 'all-schools');
    setTags([]);
    setNewTag('');
    setImageFile(null);
    setImagePreview(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 5) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      try {
        const dataURL = await fileToDataURL(file);
        setImagePreview(dataURL);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Helper function to compress images
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          
          // Calculate new dimensions (max 1920px width)
          let width = img.width;
          let height = img.height;
          if (width > 1920) {
            height = (height / width) * 1920;
            width = 1920;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              resolve(new File([blob!], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            },
            'image/jpeg',
            0.85 // 85% quality
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image too large. Max size is 10MB.');
      }
      
      // Compress image if needed
      let fileToUpload = file;
      if (file.size > 2 * 1024 * 1024) { // > 2MB
        console.log('Compressing image...');
        fileToUpload = await compressImage(file);
        console.log(`Compressed ${file.size} → ${fileToUpload.size}`);
      }
      
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Upload with progress tracking (simulated since Supabase storage doesn't support progress)
      setUploadProgress(30);
      
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(fileName, fileToUpload);
      
      if (error) throw error;
      
      setUploadProgress(80);
      
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(data.path);
      
      setUploadProgress(100);
      return publicUrl;
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to upload image');
      
      toast({
        title: "Upload Failed",
        description: error.message || 'Failed to upload image',
        variant: "destructive",
      });
      
      return null;
    }
  };

  const handleCreatePost = async () => {
    if (!content.trim()) return;

    setUploading(true);
    
    let imageUrl: string | undefined;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile) || undefined;
    }
    
    const success = await onCreatePost({
      content,
      imageUrl,
      targetMajor: targetMajor === 'all-majors' ? undefined : targetMajor,
      targetCommunity: targetCommunity === 'all-schools' ? undefined : targetCommunity,
      postType,
      visibility,
      tags
    });

    if (success) {
      handleClose();
    }
    
    setUploading(false);
  };

  const selectedPostType = POST_TYPES.find(type => type.value === postType);
  const selectedVisibility = VISIBILITY_OPTIONS.find(opt => opt.value === visibility);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>
                {profile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-semibold text-foreground">
                {profile?.display_name || 'Unknown User'}
              </h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {profile?.school && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <School className="h-3 w-3" />
                    {profile.school}
                  </Badge>
                )}
                {profile?.major && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {profile.major}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Post Content */}
          <div className="space-y-2">
            <Label htmlFor="content">What's on your mind?</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Share something with your community..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Post Type */}
          <div className="space-y-2">
            <Label htmlFor="post-type">Post Type</Label>
            <AccessibleDropdown
              trigger={
                <>
                  {selectedPostType && <selectedPostType.icon className="h-4 w-4" />}
                  {selectedPostType?.label}
                </>
              }
            >
              {POST_TYPES.map((type) => (
                <AccessibleDropdownItem
                  key={type.value}
                  onClick={() => setPostType(type.value)}
                  selected={postType === type.value}
                  icon={type.icon}
                >
                  {type.label}
                </AccessibleDropdownItem>
              ))}
            </AccessibleDropdown>
          </div>

          {/* Target Audience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Major */}
            <div className="space-y-2">
              <Label htmlFor="target-major">Target Major (Optional)</Label>
              <AccessibleDropdown
                trigger={targetMajor === 'all-majors' ? 'All majors' : targetMajor}
              >
                <ScrollArea className="h-[300px]">
                  <AccessibleDropdownItem
                    onClick={() => setTargetMajor('all-majors')}
                    selected={targetMajor === 'all-majors'}
                  >
                    All majors
                  </AccessibleDropdownItem>
                  {collegeMajors.map((major) => (
                    <AccessibleDropdownItem
                      key={major}
                      onClick={() => setTargetMajor(major)}
                      selected={targetMajor === major}
                    >
                      {major}
                    </AccessibleDropdownItem>
                  ))}
                </ScrollArea>
              </AccessibleDropdown>
            </div>

            {/* Target Community/School */}
            <div className="space-y-2">
              <Label htmlFor="target-school">Target School (Optional)</Label>
              <AccessibleDropdown
                trigger={targetCommunity === 'all-schools' ? 'All schools' : targetCommunity}
              >
                <ScrollArea className="h-[300px]">
                  <AccessibleDropdownItem
                    onClick={() => setTargetCommunity('all-schools')}
                    selected={targetCommunity === 'all-schools'}
                  >
                    All schools
                  </AccessibleDropdownItem>
                  {universities.map((university) => (
                    <AccessibleDropdownItem
                      key={university.id}
                      onClick={() => setTargetCommunity(university.name)}
                      selected={targetCommunity === university.name}
                    >
                      {university.name}
                    </AccessibleDropdownItem>
                  ))}
                </ScrollArea>
              </AccessibleDropdown>
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Who can see this post?</Label>
            <AccessibleDropdown
              trigger={
                <>
                  {selectedVisibility && <selectedVisibility.icon className="h-4 w-4" />}
                  <div>
                    <span className="font-medium">{selectedVisibility?.label}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {selectedVisibility?.description}
                    </span>
                  </div>
                </>
              }
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <AccessibleDropdownItem
                  key={option.value}
                  onClick={() => setVisibility(option.value)}
                  selected={visibility === option.value}
                >
                  <option.icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                </AccessibleDropdownItem>
              ))}
            </AccessibleDropdown>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (Optional)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  #{tag}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => removeTag(tag)}
                  />
                </Badge>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <Input
                  id="post-tag-input"
                  name="post-tag-input"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTag}
                  disabled={!newTag.trim()}
                >
                  Add
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add up to 5 tags to help others find your post
            </p>
          </div>

          <Separator />

          {/* Image Upload and Actions */}
          <div className="space-y-4">
            {/* Image Preview */}
            {imagePreview && (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full max-h-64 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <input
                  id="image-upload"
                  name="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <label htmlFor="image-upload">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 cursor-pointer"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      Add Image
                    </span>
                  </Button>
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePost}
                  disabled={!content.trim() || uploading}
                >
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};