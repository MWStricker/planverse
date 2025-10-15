export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      calendar_connections: {
        Row: {
          access_token_enc: string | null
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          provider_id: string | null
          refresh_token_enc: string | null
          scope: string | null
          sync_settings: Json | null
          token_expires_at: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider: string
          provider_id?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          sync_settings?: Json | null
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          provider_id?: string | null
          refresh_token_enc?: string | null
          scope?: string | null
          sync_settings?: Json | null
          token_expires_at?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_flags: Json | null
          moderation_score: number | null
          moderation_status:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          event_type: string | null
          id: string
          is_all_day: boolean | null
          is_completed: boolean | null
          location: string | null
          recurrence_rule: string | null
          source_event_id: string | null
          source_provider: string
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          is_completed?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          source_event_id?: string | null
          source_provider: string
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string | null
          id?: string
          is_all_day?: boolean | null
          is_completed?: boolean | null
          location?: string | null
          recurrence_rule?: string | null
          source_event_id?: string | null
          source_provider?: string
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          receiver_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_logs: {
        Row: {
          action: string
          ai_reasoning: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          moderation_flags: Json | null
          moderation_score: number | null
          moderator_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          ai_reasoning?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderator_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          ai_reasoning?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderator_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          parsed_events: Json | null
          processed_at: string | null
          processing_status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          parsed_events?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          parsed_events?: Json | null
          processed_at?: string | null
          processing_status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_flags: Json | null
          moderation_score: number | null
          moderation_status:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_type: string | null
          tags: string[] | null
          target_community: string | null
          target_major: string | null
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_type?: string | null
          tags?: string[] | null
          target_community?: string | null
          target_major?: string | null
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          post_type?: string | null
          tags?: string[] | null
          target_community?: string | null
          target_major?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          campus_location: string | null
          created_at: string
          display_name: string | null
          graduation_year: number | null
          id: string
          is_public: boolean | null
          major: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          school: string | null
          social_links: Json | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          campus_location?: string | null
          created_at?: string
          display_name?: string | null
          graduation_year?: number | null
          id?: string
          is_public?: boolean | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          school?: string | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          campus_location?: string | null
          created_at?: string
          display_name?: string | null
          graduation_year?: number | null
          id?: string
          is_public?: boolean | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          school?: string | null
          social_links?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_confirmed: boolean | null
          location: string | null
          notes: string | null
          session_type: string | null
          start_time: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_confirmed?: boolean | null
          location?: string | null
          notes?: string | null
          session_type?: string | null
          start_time: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_confirmed?: boolean | null
          location?: string | null
          notes?: string | null
          session_type?: string | null
          start_time?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          completed_at: string | null
          completion_status: string | null
          complexity_level: number | null
          course_name: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          grade_weight: number | null
          id: string
          is_recurring: boolean | null
          parent_task_id: string | null
          prerequisites: string[] | null
          priority_score: number | null
          recurrence_pattern: Json | null
          recurrence_type: string | null
          source_assignment_id: string | null
          source_provider: string | null
          task_steps: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          completed_at?: string | null
          completion_status?: string | null
          complexity_level?: number | null
          course_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          grade_weight?: number | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          prerequisites?: string[] | null
          priority_score?: number | null
          recurrence_pattern?: Json | null
          recurrence_type?: string | null
          source_assignment_id?: string | null
          source_provider?: string | null
          task_steps?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_hours?: number | null
          completed_at?: string | null
          completion_status?: string | null
          complexity_level?: number | null
          course_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          grade_weight?: number | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          prerequisites?: string[] | null
          priority_score?: number | null
          recurrence_pattern?: Json | null
          recurrence_type?: string | null
          source_assignment_id?: string | null
          source_provider?: string | null
          task_steps?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          account_status: string
          created_at: string
          email: string | null
          id: string
          last_sign_in_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          email?: string | null
          id?: string
          last_sign_in_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          email?: string | null
          id?: string
          last_sign_in_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          campus_hangout_spots: string[] | null
          clubs_and_events: string[] | null
          completed_at: string | null
          created_at: string | null
          id: string
          music_genres: Json | null
          music_preference: string
          onboarding_completed: boolean | null
          passion_outside_school: string | null
          questions_asked: Json
          reason_for_school: string | null
          updated_at: string | null
          user_id: string
          year_in_school: string | null
        }
        Insert: {
          campus_hangout_spots?: string[] | null
          clubs_and_events?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          music_genres?: Json | null
          music_preference: string
          onboarding_completed?: boolean | null
          passion_outside_school?: string | null
          questions_asked: Json
          reason_for_school?: string | null
          updated_at?: string | null
          user_id: string
          year_in_school?: string | null
        }
        Update: {
          campus_hangout_spots?: string[] | null
          clubs_and_events?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          music_genres?: Json | null
          music_preference?: string
          onboarding_completed?: boolean | null
          passion_outside_school?: string | null
          questions_asked?: Json
          reason_for_school?: string | null
          updated_at?: string | null
          user_id?: string
          year_in_school?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          settings_data: Json
          settings_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings_data?: Json
          settings_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings_data?: Json
          settings_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_interest_match_score: {
        Args: { user1_id: string; user2_id: string }
        Returns: number
      }
      decrement_likes_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      get_or_create_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_suggested_matches: {
        Args: { match_limit?: number; target_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          major: string
          match_score: number
          school: string
          shared_interests: Json
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_comments_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_likes_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      test_auth_uid: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      moderation_status:
        | "pending"
        | "approved"
        | "rejected"
        | "flagged"
        | "auto_hidden"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      moderation_status: [
        "pending",
        "approved",
        "rejected",
        "flagged",
        "auto_hidden",
      ],
    },
  },
} as const
