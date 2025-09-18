import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Hash, Users, GraduationCap, Globe, Calendar } from 'lucide-react';
import { collegeMajors } from '@/data/collegeMajors';
import { universities } from '@/data/universities';

interface PostFiltersProps {
  onFilterChange: (filters: {
    search: string;
    postType: string;
    major: string;
    school: string;
    sortBy: string;
  }) => void;
}

const POST_TYPES = [
  { value: 'all-types', label: 'All Types', icon: Globe },
  { value: 'general', label: 'General', icon: Globe },
  { value: 'academic', label: 'Academic', icon: GraduationCap },
  { value: 'social', label: 'Social', icon: Users },
  { value: 'announcement', label: 'Announcement', icon: Hash },
  { value: 'question', label: 'Question', icon: Hash },
  { value: 'study-group', label: 'Study Group', icon: Users },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', icon: Calendar },
  { value: 'oldest', label: 'Oldest First', icon: Calendar },
  { value: 'most-liked', label: 'Most Liked', icon: Hash },
  { value: 'most-commented', label: 'Most Commented', icon: Hash },
];

export const PostFilters: React.FC<PostFiltersProps> = ({ onFilterChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPostType, setSelectedPostType] = useState('all-types');
  const [selectedMajor, setSelectedMajor] = useState('all-majors');
  const [selectedSchool, setSelectedSchool] = useState('all-schools');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterUpdate = (updates: Partial<{
    search: string;
    postType: string;
    major: string;
    school: string;
    sortBy: string;
  }>) => {
    const newFilters = {
      search: updates.search ?? searchQuery,
      postType: updates.postType === 'all-types' ? '' : (updates.postType ?? selectedPostType),
      major: updates.major === 'all-majors' ? '' : (updates.major ?? selectedMajor),
      school: updates.school === 'all-schools' ? '' : (updates.school ?? selectedSchool),
      sortBy: updates.sortBy ?? selectedSort,
    };

    // Update local state
    if (updates.search !== undefined) setSearchQuery(updates.search);
    if (updates.postType !== undefined) setSelectedPostType(updates.postType);
    if (updates.major !== undefined) setSelectedMajor(updates.major);
    if (updates.school !== undefined) setSelectedSchool(updates.school);
    if (updates.sortBy !== undefined) setSelectedSort(updates.sortBy);

    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    handleFilterUpdate({
      search: '',
      postType: 'all-types',
      major: 'all-majors',
      school: 'all-schools',
      sortBy: 'newest'
    });
  };

  const activeFiltersCount = [selectedPostType === 'all-types' ? '' : selectedPostType, selectedMajor === 'all-majors' ? '' : selectedMajor, selectedSchool === 'all-schools' ? '' : selectedSchool].filter(Boolean).length;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Filter Posts
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {isExpanded ? 'Less' : 'More'} Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="space-y-2">
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => handleFilterUpdate({ search: e.target.value })}
            className="w-full"
          />
        </div>

        {/* Sort */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort By</label>
            <Select value={selectedSort} onValueChange={(value) => handleFilterUpdate({ sortBy: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Post Type</label>
            <Select value={selectedPostType} onValueChange={(value) => handleFilterUpdate({ postType: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Major</label>
              <Select value={selectedMajor} onValueChange={(value) => handleFilterUpdate({ major: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All majors" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="all-majors">All majors</SelectItem>
                  {collegeMajors.slice(0, 20).map((major) => (
                    <SelectItem key={major} value={major}>
                      {major}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by School</label>
              <Select value={selectedSchool} onValueChange={(value) => handleFilterUpdate({ school: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="all-schools">All schools</SelectItem>
                  {universities.slice(0, 20).map((university) => (
                    <SelectItem key={university.id} value={university.name}>
                      {university.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear All Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};