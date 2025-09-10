// Import university logos
import harvardLogo from '@/assets/university-logos/harvard.png';
import stanfordLogo from '@/assets/university-logos/stanford.png';
import mitLogo from '@/assets/university-logos/mit.png';
import yaleLogo from '@/assets/university-logos/yale.png';
import berkeleyLogo from '@/assets/university-logos/berkeley.png';
import uclaLogo from '@/assets/university-logos/ucla.png';
import michiganLogo from '@/assets/university-logos/michigan.png';
import texasLogo from '@/assets/university-logos/texas.png';
import floridaLogo from '@/assets/university-logos/florida.png';
import gatechLogo from '@/assets/university-logos/gatech.png';
import alabamaLogo from '@/assets/university-logos/alabama.png';
import asuLogo from '@/assets/university-logos/asu.png';
import auburnLogo from '@/assets/university-logos/auburn.png';
import coloradoLogo from '@/assets/university-logos/colorado.png';
import uconnLogo from '@/assets/university-logos/uconn.png';
import fsuLogo from '@/assets/university-logos/fsu.png';
import georgiaLogo from '@/assets/university-logos/georgia.png';
import iowaLogo from '@/assets/university-logos/iowa.png';
import iowaStateLogo from '@/assets/university-logos/iowa-state.png';
import lsuLogo from '@/assets/university-logos/lsu.png';
import marylandLogo from '@/assets/university-logos/maryland.png';
import michiganStateLogo from '@/assets/university-logos/michigan-state.png';
import minnesotaLogo from '@/assets/university-logos/minnesota.png';
import uncLogo from '@/assets/university-logos/unc.png';
import ohioStateLogo from '@/assets/university-logos/ohio-state.png';

export interface University {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  type: 'ivy-league' | 'top-tier' | 'state' | 'private' | 'community' | 'other';
  state?: string;
  isPublic?: boolean;
}

// Helper function to create university objects with proper typing
const createUniversity = (data: University): University => data;

export const universities: University[] = [
  // PUBLIC UNIVERSITIES IN ALPHABETICAL ORDER
  createUniversity({ id: 'alabama', name: 'University of Alabama', shortName: 'Alabama', logo: alabamaLogo, type: 'state', state: 'AL', isPublic: true }),
  createUniversity({ id: 'alabama-birmingham', name: 'University of Alabama at Birmingham', shortName: 'UAB', type: 'state', state: 'AL', isPublic: true }),
  createUniversity({ id: 'alabama-huntsville', name: 'University of Alabama in Huntsville', shortName: 'UAH', type: 'state', state: 'AL', isPublic: true }),
  createUniversity({ id: 'alaska-anchorage', name: 'University of Alaska Anchorage', shortName: 'UAA', type: 'state', state: 'AK', isPublic: true }),
  createUniversity({ id: 'alaska-fairbanks', name: 'University of Alaska Fairbanks', shortName: 'UAF', type: 'state', state: 'AK', isPublic: true }),
  createUniversity({ id: 'arizona', name: 'University of Arizona', shortName: 'Arizona', type: 'state', state: 'AZ', isPublic: true }),
  createUniversity({ id: 'arizona-state', name: 'Arizona State University', shortName: 'ASU', logo: asuLogo, type: 'state', state: 'AZ', isPublic: true }),
  createUniversity({ id: 'arkansas', name: 'University of Arkansas', shortName: 'Arkansas', type: 'state', state: 'AR', isPublic: true }),
  createUniversity({ id: 'arkansas-little-rock', name: 'University of Arkansas at Little Rock', shortName: 'UALR', type: 'state', state: 'AR', isPublic: true }),
  createUniversity({ id: 'auburn', name: 'Auburn University', shortName: 'Auburn', logo: auburnLogo, type: 'state', state: 'AL', isPublic: true }),
  createUniversity({ id: 'ball-state', name: 'Ball State University', shortName: 'Ball State', type: 'state', state: 'IN', isPublic: true }),
  createUniversity({ id: 'boise-state', name: 'Boise State University', shortName: 'Boise State', type: 'state', state: 'ID', isPublic: true }),
  createUniversity({ id: 'bowling-green', name: 'Bowling Green State University', shortName: 'BGSU', type: 'state', state: 'OH', isPublic: true }),
  createUniversity({ id: 'cal-poly-pomona', name: 'California State Polytechnic University, Pomona', shortName: 'Cal Poly Pomona', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-poly-slo', name: 'California Polytechnic State University', shortName: 'Cal Poly SLO', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-fullerton', name: 'California State University, Fullerton', shortName: 'Cal State Fullerton', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-long-beach', name: 'California State University, Long Beach', shortName: 'Cal State Long Beach', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-los-angeles', name: 'California State University, Los Angeles', shortName: 'Cal State LA', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-northridge', name: 'California State University, Northridge', shortName: 'CSUN', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-sacramento', name: 'California State University, Sacramento', shortName: 'Sac State', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'cal-state-san-bernardino', name: 'California State University, San Bernardino', shortName: 'CSUSB', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'central-florida', name: 'University of Central Florida', shortName: 'UCF', type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'central-michigan', name: 'Central Michigan University', shortName: 'Central Michigan', type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'cincinnati', name: 'University of Cincinnati', shortName: 'Cincinnati', type: 'state', state: 'OH', isPublic: true }),
  createUniversity({ id: 'clemson', name: 'Clemson University', shortName: 'Clemson', type: 'state', state: 'SC', isPublic: true }),
  createUniversity({ id: 'colorado', name: 'University of Colorado Boulder', shortName: 'CU Boulder', logo: coloradoLogo, type: 'state', state: 'CO', isPublic: true }),
  createUniversity({ id: 'colorado-denver', name: 'University of Colorado Denver', shortName: 'CU Denver', type: 'state', state: 'CO', isPublic: true }),
  createUniversity({ id: 'colorado-state', name: 'Colorado State University', shortName: 'Colorado State', type: 'state', state: 'CO', isPublic: true }),
  createUniversity({ id: 'connecticut', name: 'University of Connecticut', shortName: 'UConn', logo: uconnLogo, type: 'state', state: 'CT', isPublic: true }),
  createUniversity({ id: 'delaware', name: 'University of Delaware', shortName: 'Delaware', type: 'state', state: 'DE', isPublic: true }),
  createUniversity({ id: 'eastern-michigan', name: 'Eastern Michigan University', shortName: 'Eastern Michigan', type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'florida', name: 'University of Florida', shortName: 'UF', logo: floridaLogo, type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'florida-atlantic', name: 'Florida Atlantic University', shortName: 'FAU', type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'florida-international', name: 'Florida International University', shortName: 'FIU', type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'florida-state', name: 'Florida State University', shortName: 'FSU', logo: fsuLogo, type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'fresno-state', name: 'California State University, Fresno', shortName: 'Fresno State', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'george-mason', name: 'George Mason University', shortName: 'George Mason', type: 'state', state: 'VA', isPublic: true }),
  createUniversity({ id: 'georgia', name: 'University of Georgia', shortName: 'UGA', logo: georgiaLogo, type: 'state', state: 'GA', isPublic: true }),
  createUniversity({ id: 'georgia-southern', name: 'Georgia Southern University', shortName: 'Georgia Southern', type: 'state', state: 'GA', isPublic: true }),
  createUniversity({ id: 'georgia-state', name: 'Georgia State University', shortName: 'Georgia State', type: 'state', state: 'GA', isPublic: true }),
  createUniversity({ id: 'georgia-tech', name: 'Georgia Institute of Technology', shortName: 'Georgia Tech', logo: gatechLogo, type: 'state', state: 'GA', isPublic: true }),
  createUniversity({ id: 'hawaii', name: 'University of Hawaii at Manoa', shortName: 'Hawaii', type: 'state', state: 'HI', isPublic: true }),
  createUniversity({ id: 'houston', name: 'University of Houston', shortName: 'Houston', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'idaho', name: 'University of Idaho', shortName: 'Idaho', type: 'state', state: 'ID', isPublic: true }),
  createUniversity({ id: 'illinois-chicago', name: 'University of Illinois at Chicago', shortName: 'UIC', type: 'state', state: 'IL', isPublic: true }),
  createUniversity({ id: 'illinois-urbana', name: 'University of Illinois at Urbana-Champaign', shortName: 'UIUC', type: 'state', state: 'IL', isPublic: true }),
  createUniversity({ id: 'indiana', name: 'Indiana University Bloomington', shortName: 'Indiana', type: 'state', state: 'IN', isPublic: true }),
  createUniversity({ id: 'iowa', name: 'University of Iowa', shortName: 'Iowa', logo: iowaLogo, type: 'state', state: 'IA', isPublic: true }),
  createUniversity({ id: 'iowa-state', name: 'Iowa State University', shortName: 'Iowa State', logo: iowaStateLogo, type: 'state', state: 'IA', isPublic: true }),
  createUniversity({ id: 'james-madison', name: 'James Madison University', shortName: 'JMU', type: 'state', state: 'VA', isPublic: true }),
  createUniversity({ id: 'kansas', name: 'University of Kansas', shortName: 'Kansas', type: 'state', state: 'KS', isPublic: true }),
  createUniversity({ id: 'kansas-state', name: 'Kansas State University', shortName: 'K-State', type: 'state', state: 'KS', isPublic: true }),
  createUniversity({ id: 'kent-state', name: 'Kent State University', shortName: 'Kent State', type: 'state', state: 'OH', isPublic: true }),
  createUniversity({ id: 'kentucky', name: 'University of Kentucky', shortName: 'Kentucky', type: 'state', state: 'KY', isPublic: true }),
  createUniversity({ id: 'louisiana-state', name: 'Louisiana State University', shortName: 'LSU', logo: lsuLogo, type: 'state', state: 'LA', isPublic: true }),
  createUniversity({ id: 'maine', name: 'University of Maine', shortName: 'Maine', type: 'state', state: 'ME', isPublic: true }),
  createUniversity({ id: 'maryland', name: 'University of Maryland, College Park', shortName: 'Maryland', logo: marylandLogo, type: 'state', state: 'MD', isPublic: true }),
  createUniversity({ id: 'massachusetts-amherst', name: 'University of Massachusetts Amherst', shortName: 'UMass Amherst', type: 'state', state: 'MA', isPublic: true }),
  createUniversity({ id: 'massachusetts-boston', name: 'University of Massachusetts Boston', shortName: 'UMass Boston', type: 'state', state: 'MA', isPublic: true }),
  createUniversity({ id: 'michigan', name: 'University of Michigan', shortName: 'Michigan', logo: michiganLogo, type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'michigan-state', name: 'Michigan State University', shortName: 'Michigan State', logo: michiganStateLogo, type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'minnesota', name: 'University of Minnesota Twin Cities', shortName: 'Minnesota', logo: minnesotaLogo, type: 'state', state: 'MN', isPublic: true }),
  createUniversity({ id: 'mississippi', name: 'University of Mississippi', shortName: 'Ole Miss', type: 'state', state: 'MS', isPublic: true }),
  createUniversity({ id: 'mississippi-state', name: 'Mississippi State University', shortName: 'Mississippi State', type: 'state', state: 'MS', isPublic: true }),
  createUniversity({ id: 'missouri', name: 'University of Missouri', shortName: 'Mizzou', type: 'state', state: 'MO', isPublic: true }),
  createUniversity({ id: 'missouri-kansas-city', name: 'University of Missouri-Kansas City', shortName: 'UMKC', type: 'state', state: 'MO', isPublic: true }),
  createUniversity({ id: 'missouri-st-louis', name: 'University of Missouri-St. Louis', shortName: 'UMSL', type: 'state', state: 'MO', isPublic: true }),
  createUniversity({ id: 'montana', name: 'University of Montana', shortName: 'Montana', type: 'state', state: 'MT', isPublic: true }),
  createUniversity({ id: 'montana-state', name: 'Montana State University', shortName: 'Montana State', type: 'state', state: 'MT', isPublic: true }),
  createUniversity({ id: 'nebraska', name: 'University of Nebraska-Lincoln', shortName: 'Nebraska', type: 'state', state: 'NE', isPublic: true }),
  createUniversity({ id: 'nevada-las-vegas', name: 'University of Nevada, Las Vegas', shortName: 'UNLV', type: 'state', state: 'NV', isPublic: true }),
  createUniversity({ id: 'nevada-reno', name: 'University of Nevada, Reno', shortName: 'Nevada', type: 'state', state: 'NV', isPublic: true }),
  createUniversity({ id: 'new-hampshire', name: 'University of New Hampshire', shortName: 'UNH', type: 'state', state: 'NH', isPublic: true }),
  createUniversity({ id: 'new-mexico', name: 'University of New Mexico', shortName: 'UNM', type: 'state', state: 'NM', isPublic: true }),
  createUniversity({ id: 'new-mexico-state', name: 'New Mexico State University', shortName: 'NMSU', type: 'state', state: 'NM', isPublic: true }),
  createUniversity({ id: 'north-carolina', name: 'University of North Carolina at Chapel Hill', shortName: 'UNC', logo: uncLogo, type: 'state', state: 'NC', isPublic: true }),
  createUniversity({ id: 'north-carolina-charlotte', name: 'University of North Carolina at Charlotte', shortName: 'UNC Charlotte', type: 'state', state: 'NC', isPublic: true }),
  createUniversity({ id: 'north-carolina-greensboro', name: 'University of North Carolina at Greensboro', shortName: 'UNCG', type: 'state', state: 'NC', isPublic: true }),
  createUniversity({ id: 'north-carolina-state', name: 'North Carolina State University', shortName: 'NC State', type: 'state', state: 'NC', isPublic: true }),
  createUniversity({ id: 'north-dakota', name: 'University of North Dakota', shortName: 'UND', type: 'state', state: 'ND', isPublic: true }),
  createUniversity({ id: 'north-dakota-state', name: 'North Dakota State University', shortName: 'NDSU', type: 'state', state: 'ND', isPublic: true }),
  createUniversity({ id: 'northern-arizona', name: 'Northern Arizona University', shortName: 'NAU', type: 'state', state: 'AZ', isPublic: true }),
  createUniversity({ id: 'northern-illinois', name: 'Northern Illinois University', shortName: 'NIU', type: 'state', state: 'IL', isPublic: true }),
  createUniversity({ id: 'ohio-state', name: 'Ohio State University', shortName: 'Ohio State', logo: ohioStateLogo, type: 'state', state: 'OH', isPublic: true }),
  createUniversity({ id: 'ohio-university', name: 'Ohio University', shortName: 'Ohio University', type: 'state', state: 'OH', isPublic: true }),
  createUniversity({ id: 'oklahoma', name: 'University of Oklahoma', shortName: 'Oklahoma', type: 'state', state: 'OK', isPublic: true }),
  createUniversity({ id: 'oklahoma-state', name: 'Oklahoma State University', shortName: 'Oklahoma State', type: 'state', state: 'OK', isPublic: true }),
  createUniversity({ id: 'oregon', name: 'University of Oregon', shortName: 'Oregon', type: 'state', state: 'OR', isPublic: true }),
  createUniversity({ id: 'oregon-state', name: 'Oregon State University', shortName: 'Oregon State', type: 'state', state: 'OR', isPublic: true }),
  createUniversity({ id: 'penn-state', name: 'Pennsylvania State University', shortName: 'Penn State', type: 'state', state: 'PA', isPublic: true }),
  createUniversity({ id: 'pittsburgh', name: 'University of Pittsburgh', shortName: 'Pitt', type: 'state', state: 'PA', isPublic: true }),
  createUniversity({ id: 'purdue', name: 'Purdue University', shortName: 'Purdue', type: 'state', state: 'IN', isPublic: true }),
  createUniversity({ id: 'rhode-island', name: 'University of Rhode Island', shortName: 'URI', type: 'state', state: 'RI', isPublic: true }),
  createUniversity({ id: 'rutgers', name: 'Rutgers University', shortName: 'Rutgers', type: 'state', state: 'NJ', isPublic: true }),
  createUniversity({ id: 'san-diego-state', name: 'San Diego State University', shortName: 'SDSU', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'san-francisco-state', name: 'San Francisco State University', shortName: 'SF State', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'san-jose-state', name: 'San José State University', shortName: 'SJSU', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'south-carolina', name: 'University of South Carolina', shortName: 'South Carolina', type: 'state', state: 'SC', isPublic: true }),
  createUniversity({ id: 'south-dakota', name: 'University of South Dakota', shortName: 'USD', type: 'state', state: 'SD', isPublic: true }),
  createUniversity({ id: 'south-dakota-state', name: 'South Dakota State University', shortName: 'SDSU', type: 'state', state: 'SD', isPublic: true }),
  createUniversity({ id: 'south-florida', name: 'University of South Florida', shortName: 'USF', type: 'state', state: 'FL', isPublic: true }),
  createUniversity({ id: 'southern-illinois', name: 'Southern Illinois University Carbondale', shortName: 'SIU', type: 'state', state: 'IL', isPublic: true }),
  createUniversity({ id: 'suny-albany', name: 'University at Albany, SUNY', shortName: 'UAlbany', type: 'state', state: 'NY', isPublic: true }),
  createUniversity({ id: 'suny-binghamton', name: 'Binghamton University, SUNY', shortName: 'Binghamton', type: 'state', state: 'NY', isPublic: true }),
  createUniversity({ id: 'suny-buffalo', name: 'University at Buffalo, SUNY', shortName: 'Buffalo', type: 'state', state: 'NY', isPublic: true }),
  createUniversity({ id: 'suny-stony-brook', name: 'Stony Brook University, SUNY', shortName: 'Stony Brook', type: 'state', state: 'NY', isPublic: true }),
  createUniversity({ id: 'temple', name: 'Temple University', shortName: 'Temple', type: 'state', state: 'PA', isPublic: true }),
  createUniversity({ id: 'tennessee', name: 'University of Tennessee, Knoxville', shortName: 'Tennessee', type: 'state', state: 'TN', isPublic: true }),
  createUniversity({ id: 'texas', name: 'University of Texas at Austin', shortName: 'UT Austin', logo: texasLogo, type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'texas-am', name: 'Texas A&M University', shortName: 'Texas A&M', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'texas-arlington', name: 'University of Texas at Arlington', shortName: 'UT Arlington', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'texas-dallas', name: 'University of Texas at Dallas', shortName: 'UT Dallas', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'texas-san-antonio', name: 'University of Texas at San Antonio', shortName: 'UTSA', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'texas-tech', name: 'Texas Tech University', shortName: 'Texas Tech', type: 'state', state: 'TX', isPublic: true }),
  createUniversity({ id: 'uc-berkeley', name: 'University of California, Berkeley', shortName: 'UC Berkeley', logo: berkeleyLogo, type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-davis', name: 'University of California, Davis', shortName: 'UC Davis', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-irvine', name: 'University of California, Irvine', shortName: 'UC Irvine', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-los-angeles', name: 'University of California, Los Angeles', shortName: 'UCLA', logo: uclaLogo, type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-merced', name: 'University of California, Merced', shortName: 'UC Merced', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-riverside', name: 'University of California, Riverside', shortName: 'UC Riverside', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-san-diego', name: 'University of California, San Diego', shortName: 'UC San Diego', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-santa-barbara', name: 'University of California, Santa Barbara', shortName: 'UC Santa Barbara', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'uc-santa-cruz', name: 'University of California, Santa Cruz', shortName: 'UC Santa Cruz', type: 'state', state: 'CA', isPublic: true }),
  createUniversity({ id: 'utah', name: 'University of Utah', shortName: 'Utah', type: 'state', state: 'UT', isPublic: true }),
  createUniversity({ id: 'utah-state', name: 'Utah State University', shortName: 'Utah State', type: 'state', state: 'UT', isPublic: true }),
  createUniversity({ id: 'vermont', name: 'University of Vermont', shortName: 'UVM', type: 'state', state: 'VT', isPublic: true }),
  createUniversity({ id: 'virginia', name: 'University of Virginia', shortName: 'UVA', type: 'state', state: 'VA', isPublic: true }),
  createUniversity({ id: 'virginia-tech', name: 'Virginia Polytechnic Institute and State University', shortName: 'Virginia Tech', type: 'state', state: 'VA', isPublic: true }),
  createUniversity({ id: 'washington', name: 'University of Washington', shortName: 'UW', type: 'state', state: 'WA', isPublic: true }),
  createUniversity({ id: 'washington-state', name: 'Washington State University', shortName: 'WSU', type: 'state', state: 'WA', isPublic: true }),
  createUniversity({ id: 'wayne-state', name: 'Wayne State University', shortName: 'Wayne State', type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'west-virginia', name: 'West Virginia University', shortName: 'WVU', type: 'state', state: 'WV', isPublic: true }),
  createUniversity({ id: 'western-michigan', name: 'Western Michigan University', shortName: 'Western Michigan', type: 'state', state: 'MI', isPublic: true }),
  createUniversity({ id: 'wisconsin-madison', name: 'University of Wisconsin-Madison', shortName: 'UW-Madison', type: 'state', state: 'WI', isPublic: true }),
  createUniversity({ id: 'wisconsin-milwaukee', name: 'University of Wisconsin-Milwaukee', shortName: 'UW-Milwaukee', type: 'state', state: 'WI', isPublic: true }),
  createUniversity({ id: 'wyoming', name: 'University of Wyoming', shortName: 'Wyoming', type: 'state', state: 'WY', isPublic: true }),

  // PRIVATE UNIVERSITIES (for completeness)
  createUniversity({ id: 'harvard', name: 'Harvard University', shortName: 'Harvard', logo: harvardLogo, type: 'ivy-league', state: 'MA', isPublic: false }),
  createUniversity({ id: 'yale', name: 'Yale University', shortName: 'Yale', logo: yaleLogo, type: 'ivy-league', state: 'CT', isPublic: false }),
  createUniversity({ id: 'princeton', name: 'Princeton University', shortName: 'Princeton', type: 'ivy-league', state: 'NJ', isPublic: false }),
  createUniversity({ id: 'stanford', name: 'Stanford University', shortName: 'Stanford', logo: stanfordLogo, type: 'top-tier', state: 'CA', isPublic: false }),
  createUniversity({ id: 'mit', name: 'Massachusetts Institute of Technology', shortName: 'MIT', logo: mitLogo, type: 'top-tier', state: 'MA', isPublic: false }),
].sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

// Helper functions
export const getUniversityById = (id: string): University | undefined => {
  return universities.find(uni => uni.id === id);
};

export const getPublicUniversities = (): University[] => {
  return universities.filter(uni => uni.isPublic === true).sort((a, b) => a.name.localeCompare(b.name));
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

export const searchPublicUniversities = (query: string): University[] => {
  const lowerQuery = query.toLowerCase();
  return getPublicUniversities().filter(uni => 
    uni.name.toLowerCase().includes(lowerQuery) || 
    uni.shortName.toLowerCase().includes(lowerQuery)
  );
};