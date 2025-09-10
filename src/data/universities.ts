// Import university logos
import harvardLogo from '@/assets/university-logos/harvard.png';
import stanfordLogo from '@/assets/university-logos/stanford.png';
import mitLogo from '@/assets/university-logos/mit.png';
import yaleLogo from '@/assets/university-logos/yale.png';
import berkeleyLogo from '@/assets/university-logos/berkeley.png';

export interface University {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  type: 'ivy-league' | 'top-tier' | 'state' | 'private' | 'community' | 'other';
  state?: string;
}

export const universities: University[] = [
  // Ivy League
  { id: 'harvard', name: 'Harvard University', shortName: 'Harvard', logo: harvardLogo, type: 'ivy-league', state: 'MA' },
  { id: 'yale', name: 'Yale University', shortName: 'Yale', logo: yaleLogo, type: 'ivy-league', state: 'CT' },
  { id: 'princeton', name: 'Princeton University', shortName: 'Princeton', type: 'ivy-league', state: 'NJ' },
  { id: 'columbia', name: 'Columbia University', shortName: 'Columbia', type: 'ivy-league', state: 'NY' },
  { id: 'upenn', name: 'University of Pennsylvania', shortName: 'UPenn', type: 'ivy-league', state: 'PA' },
  { id: 'dartmouth', name: 'Dartmouth College', shortName: 'Dartmouth', type: 'ivy-league', state: 'NH' },
  { id: 'brown', name: 'Brown University', shortName: 'Brown', type: 'ivy-league', state: 'RI' },
  { id: 'cornell', name: 'Cornell University', shortName: 'Cornell', type: 'ivy-league', state: 'NY' },

  // Top Tier Private
  { id: 'stanford', name: 'Stanford University', shortName: 'Stanford', logo: stanfordLogo, type: 'top-tier', state: 'CA' },
  { id: 'mit', name: 'Massachusetts Institute of Technology', shortName: 'MIT', logo: mitLogo, type: 'top-tier', state: 'MA' },
  { id: 'caltech', name: 'California Institute of Technology', shortName: 'Caltech', type: 'top-tier', state: 'CA' },
  { id: 'chicago', name: 'University of Chicago', shortName: 'UChicago', type: 'top-tier', state: 'IL' },
  { id: 'northwestern', name: 'Northwestern University', shortName: 'Northwestern', type: 'top-tier', state: 'IL' },
  { id: 'duke', name: 'Duke University', shortName: 'Duke', type: 'top-tier', state: 'NC' },
  { id: 'johns-hopkins', name: 'Johns Hopkins University', shortName: 'Johns Hopkins', type: 'top-tier', state: 'MD' },
  { id: 'vanderbilt', name: 'Vanderbilt University', shortName: 'Vanderbilt', type: 'top-tier', state: 'TN' },
  { id: 'rice', name: 'Rice University', shortName: 'Rice', type: 'top-tier', state: 'TX' },
  { id: 'notre-dame', name: 'University of Notre Dame', shortName: 'Notre Dame', type: 'top-tier', state: 'IN' },

  // Top Public Universities (UC System)
  { id: 'berkeley', name: 'University of California, Berkeley', shortName: 'UC Berkeley', logo: berkeleyLogo, type: 'state', state: 'CA' },
  { id: 'ucla', name: 'University of California, Los Angeles', shortName: 'UCLA', type: 'state', state: 'CA' },
  { id: 'ucsd', name: 'University of California, San Diego', shortName: 'UC San Diego', type: 'state', state: 'CA' },
  { id: 'ucsb', name: 'University of California, Santa Barbara', shortName: 'UC Santa Barbara', type: 'state', state: 'CA' },
  { id: 'uci', name: 'University of California, Irvine', shortName: 'UC Irvine', type: 'state', state: 'CA' },
  { id: 'ucd', name: 'University of California, Davis', shortName: 'UC Davis', type: 'state', state: 'CA' },
  { id: 'ucsc', name: 'University of California, Santa Cruz', shortName: 'UC Santa Cruz', type: 'state', state: 'CA' },
  { id: 'ucr', name: 'University of California, Riverside', shortName: 'UC Riverside', type: 'state', state: 'CA' },
  { id: 'ucm', name: 'University of California, Merced', shortName: 'UC Merced', type: 'state', state: 'CA' },

  // Other Top State Schools
  { id: 'umich', name: 'University of Michigan', shortName: 'U of Michigan', type: 'state', state: 'MI' },
  { id: 'uva', name: 'University of Virginia', shortName: 'UVA', type: 'state', state: 'VA' },
  { id: 'unc', name: 'University of North Carolina at Chapel Hill', shortName: 'UNC', type: 'state', state: 'NC' },
  { id: 'ut-austin', name: 'University of Texas at Austin', shortName: 'UT Austin', type: 'state', state: 'TX' },
  { id: 'gatech', name: 'Georgia Institute of Technology', shortName: 'Georgia Tech', type: 'state', state: 'GA' },
  { id: 'uiuc', name: 'University of Illinois at Urbana-Champaign', shortName: 'UIUC', type: 'state', state: 'IL' },
  { id: 'uw-madison', name: 'University of Wisconsin-Madison', shortName: 'UW-Madison', type: 'state', state: 'WI' },
  { id: 'ohio-state', name: 'Ohio State University', shortName: 'Ohio State', type: 'state', state: 'OH' },
  { id: 'penn-state', name: 'Pennsylvania State University', shortName: 'Penn State', type: 'state', state: 'PA' },
  { id: 'purdue', name: 'Purdue University', shortName: 'Purdue', type: 'state', state: 'IN' },

  // SUNY System
  { id: 'stony-brook', name: 'Stony Brook University', shortName: 'Stony Brook', type: 'state', state: 'NY' },
  { id: 'binghamton', name: 'Binghamton University', shortName: 'Binghamton', type: 'state', state: 'NY' },
  { id: 'buffalo', name: 'University at Buffalo', shortName: 'Buffalo', type: 'state', state: 'NY' },
  { id: 'albany', name: 'University at Albany', shortName: 'Albany', type: 'state', state: 'NY' },

  // Liberal Arts Colleges
  { id: 'williams', name: 'Williams College', shortName: 'Williams', type: 'private', state: 'MA' },
  { id: 'amherst', name: 'Amherst College', shortName: 'Amherst', type: 'private', state: 'MA' },
  { id: 'swarthmore', name: 'Swarthmore College', shortName: 'Swarthmore', type: 'private', state: 'PA' },
  { id: 'middlebury', name: 'Middlebury College', shortName: 'Middlebury', type: 'private', state: 'VT' },
  { id: 'bowdoin', name: 'Bowdoin College', shortName: 'Bowdoin', type: 'private', state: 'ME' },
  { id: 'carleton', name: 'Carleton College', shortName: 'Carleton', type: 'private', state: 'MN' },
  { id: 'pomona', name: 'Pomona College', shortName: 'Pomona', type: 'private', state: 'CA' },

  // Other Notable Universities
  { id: 'nyu', name: 'New York University', shortName: 'NYU', type: 'private', state: 'NY' },
  { id: 'usc', name: 'University of Southern California', shortName: 'USC', type: 'private', state: 'CA' },
  { id: 'boston-university', name: 'Boston University', shortName: 'BU', type: 'private', state: 'MA' },
  { id: 'georgetown', name: 'Georgetown University', shortName: 'Georgetown', type: 'private', state: 'DC' },
  { id: 'carnegie-mellon', name: 'Carnegie Mellon University', shortName: 'Carnegie Mellon', type: 'private', state: 'PA' },
  { id: 'washington-university', name: 'Washington University in St. Louis', shortName: 'WashU', type: 'private', state: 'MO' },
  { id: 'emory', name: 'Emory University', shortName: 'Emory', type: 'private', state: 'GA' },
  { id: 'tufts', name: 'Tufts University', shortName: 'Tufts', type: 'private', state: 'MA' },
  { id: 'wake-forest', name: 'Wake Forest University', shortName: 'Wake Forest', type: 'private', state: 'NC' },

  // Technology Schools
  { id: 'rpi', name: 'Rensselaer Polytechnic Institute', shortName: 'RPI', type: 'private', state: 'NY' },
  { id: 'wpi', name: 'Worcester Polytechnic Institute', shortName: 'WPI', type: 'private', state: 'MA' },
  { id: 'stevens', name: 'Stevens Institute of Technology', shortName: 'Stevens', type: 'private', state: 'NJ' },
  { id: 'cooper-union', name: 'Cooper Union', shortName: 'Cooper Union', type: 'private', state: 'NY' },

  // Community Colleges (Sample)
  { id: 'santa-monica', name: 'Santa Monica College', shortName: 'SMC', type: 'community', state: 'CA' },
  { id: 'valencia', name: 'Valencia College', shortName: 'Valencia', type: 'community', state: 'FL' },
  { id: 'northern-virginia', name: 'Northern Virginia Community College', shortName: 'NOVA', type: 'community', state: 'VA' },
];

// Helper functions
export const getUniversityById = (id: string): University | undefined => {
  return universities.find(uni => uni.id === id);
};

export const getUniversitiesByType = (type: University['type']): University[] => {
  return universities.filter(uni => uni.type === type);
};

export const getUniversitiesByState = (state: string): University[] => {
  return universities.filter(uni => uni.state === state);
};

export const searchUniversities = (query: string): University[] => {
  const lowerQuery = query.toLowerCase();
  return universities.filter(uni => 
    uni.name.toLowerCase().includes(lowerQuery) || 
    uni.shortName.toLowerCase().includes(lowerQuery)
  );
};
