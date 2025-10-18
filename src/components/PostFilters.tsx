import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeDropdown, NativeDropdownItem } from '@/components/ui/native-dropdown';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Card className="mb-8">
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
      
      <CardContent className="space-y-4 pb-6">
        {/* Search */}
        <div className="space-y-2">
          <Input
            id="post-search"
            name="post-search"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => handleFilterUpdate({ search: e.target.value })}
            className="w-full"
          />
        </div>

        {/* Sort */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="sort-by" className="text-sm font-medium">Sort By</label>
            <NativeDropdown
              trigger={SORT_OPTIONS.find(o => o.value === selectedSort)?.label || 'Newest First'}
              label="Select sort order"
              triggerClassName="w-full justify-start border border-input bg-background px-3 py-2 rounded-md hover:bg-accent"
            >
              {SORT_OPTIONS.map((option) => (
                <NativeDropdownItem
                  key={option.value}
                  onClick={() => handleFilterUpdate({ sortBy: option.value })}
                  checked={selectedSort === option.value}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </NativeDropdownItem>
              ))}
            </NativeDropdown>
          </div>

          <div className="space-y-2">
            <label htmlFor="post-type" className="text-sm font-medium">Post Type</label>
            <NativeDropdown
              trigger={POST_TYPES.find(t => t.value === selectedPostType)?.label || 'All Types'}
              label="Select post type"
              triggerClassName="w-full justify-start border border-input bg-background px-3 py-2 rounded-md hover:bg-accent"
            >
              {POST_TYPES.map((type) => (
                <NativeDropdownItem
                  key={type.value}
                  onClick={() => handleFilterUpdate({ postType: type.value })}
                  checked={selectedPostType === type.value}
                >
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </NativeDropdownItem>
              ))}
            </NativeDropdown>
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label htmlFor="filter-major" className="text-sm font-medium">Filter by Major</label>
              <NativeDropdown
                trigger={selectedMajor === 'all-majors' ? 'All majors' : selectedMajor}
                label="Select major filter"
                triggerClassName="w-full justify-start border border-input bg-background px-3 py-2 rounded-md hover:bg-accent"
              >
                <ScrollArea className="h-[300px]">
                  <NativeDropdownItem
                    onClick={() => handleFilterUpdate({ major: 'all-majors' })}
                    checked={selectedMajor === 'all-majors'}
                  >
                    All majors
                  </NativeDropdownItem>
                  {collegeMajors.map((major) => (
                    <NativeDropdownItem
                      key={major}
                      onClick={() => handleFilterUpdate({ major: major })}
                      checked={selectedMajor === major}
                    >
                      {major}
                    </NativeDropdownItem>
                  ))}
                </ScrollArea>
              </NativeDropdown>
            </div>

            <div className="space-y-2">
              <label htmlFor="filter-school" className="text-sm font-medium">Filter by School</label>
              <NativeDropdown
                trigger={selectedSchool === 'all-schools' ? 'All schools' : selectedSchool}
                label="Select school filter"
                triggerClassName="w-full justify-start border border-input bg-background px-3 py-2 rounded-md hover:bg-accent"
              >
                <ScrollArea className="h-[300px]">
                  <NativeDropdownItem
                    onClick={() => handleFilterUpdate({ school: 'all-schools' })}
                    checked={selectedSchool === 'all-schools'}
                  >
                    All schools
                  </NativeDropdownItem>
                  {universities.map((university) => (
                    <NativeDropdownItem
                      key={university.id}
                      onClick={() => handleFilterUpdate({ school: university.name })}
                      checked={selectedSchool === university.name}
                    >
                      {university.name}
                    </NativeDropdownItem>
                  ))}
                </ScrollArea>
              </NativeDropdown>
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