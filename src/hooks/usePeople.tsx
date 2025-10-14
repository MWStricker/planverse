import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { fetchSuggestedMatches, MatchedUser } from '@/lib/matching-utils';

export interface Person {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  school?: string;
  major?: string;
  bio?: string;
  graduation_year?: number;
  created_at: string;
}

export const usePeople = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [suggestedMatches, setSuggestedMatches] = useState<MatchedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPeople = async (query?: string, excludeUserIds?: string[]) => {
    if (!user) return;

    try {
      setLoading(true);
      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .eq('is_public', true)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (excludeUserIds && excludeUserIds.length > 0) {
        queryBuilder = queryBuilder.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
      }

      if (query && query.trim()) {
        queryBuilder = queryBuilder.or(`
          display_name.ilike.%${query}%,
          school.ilike.%${query}%,
          major.ilike.%${query}%,
          bio.ilike.%${query}%
        `);
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) throw error;

      setPeople(data || []);
    } catch (error) {
      console.error('Error fetching people:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchPeople = async (query: string, excludeUserIds?: string[]) => {
    setSearchQuery(query);
    await fetchPeople(query, excludeUserIds);
  };

  const fetchPeopleBySchool = async (school: string, excludeUserIds?: string[]) => {
    if (!user) return;

    try {
      setLoading(true);
      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .eq('is_public', true)
        .eq('school', school)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (excludeUserIds && excludeUserIds.length > 0) {
        queryBuilder = queryBuilder.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) throw error;

      setPeople(data || []);
    } catch (error) {
      console.error('Error fetching people by school:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeopleByMajor = async (major: string, excludeUserIds?: string[]) => {
    if (!user) return;

    try {
      setLoading(true);
      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .eq('is_public', true)
        .eq('major', major)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (excludeUserIds && excludeUserIds.length > 0) {
        queryBuilder = queryBuilder.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) throw error;

      setPeople(data || []);
    } catch (error) {
      console.error('Error fetching people by major:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPersonByUserId = async (userId: string): Promise<Person | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching person:', error);
      return null;
    }
  };

  const loadSuggestedMatches = async () => {
    setLoading(true);
    const matches = await fetchSuggestedMatches(20);
    setSuggestedMatches(matches);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchPeople();
      loadSuggestedMatches();
    }
  }, [user]);

  return {
    people,
    suggestedMatches,
    loading,
    searchQuery,
    fetchPeople,
    searchPeople,
    fetchPeopleBySchool,
    fetchPeopleByMajor,
    getPersonByUserId,
    loadSuggestedMatches
  };
};