export type DatabaseJson =
  string | number | boolean | null | { [key: string]: DatabaseJson | undefined } | DatabaseJson[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          timezone: string;
          locale: string;
          unit_system: 'metric' | 'imperial';
          week_starts_on: 0 | 1;
          calorie_display: boolean;
          analytics_consent: boolean;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          timezone?: string;
          locale?: string;
          unit_system?: 'metric' | 'imperial';
          week_starts_on?: 0 | 1;
          calorie_display?: boolean;
          analytics_consent?: boolean;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          timezone?: string;
          locale?: string;
          unit_system?: 'metric' | 'imperial';
          week_starts_on?: 0 | 1;
          calorie_display?: boolean;
          analytics_consent?: boolean;
          onboarding_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      weight_entries: {
        Row: {
          id: string;
          user_id: string;
          measured_on: string;
          weight_kg: number;
          note: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          measured_on: string;
          weight_kg: number;
          note?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          measured_on?: string;
          weight_kg?: number;
          note?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      weight_goals: {
        Row: {
          id: string;
          user_id: string;
          target_weight_kg: number;
          target_date: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          target_weight_kg: number;
          target_date?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          target_weight_kg?: number;
          target_date?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      food_entries: {
        Row: {
          id: string;
          user_id: string;
          consumed_on: string;
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
          name: string;
          quantity: number;
          unit: string;
          calories_kcal: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          note: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          consumed_on: string;
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
          name: string;
          quantity: number;
          unit: string;
          calories_kcal: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          note?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          consumed_on?: string;
          meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
          name?: string;
          quantity?: number;
          unit?: string;
          calories_kcal?: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          note?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      nutrition_targets: {
        Row: {
          id: string;
          user_id: string;
          effective_from: string;
          calories_kcal: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          effective_from: string;
          calories_kcal: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          effective_from?: string;
          calories_kcal?: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      food_favourites: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          quantity: number;
          unit: string;
          calories_kcal: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          quantity: number;
          unit: string;
          calories_kcal: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          quantity?: number;
          unit?: string;
          calories_kcal?: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      exercise_routines: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          name: string;
          description: string;
          estimated_minutes: number;
          version: number;
          steps: DatabaseJson;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          family_id: string;
          user_id: string;
          name: string;
          description?: string;
          estimated_minutes: number;
          version: number;
          steps: DatabaseJson;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          family_id?: string;
          name?: string;
          description?: string;
          estimated_minutes?: number;
          version?: number;
          steps?: DatabaseJson;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string | null;
          routine_name: string;
          activity_type: string;
          completed_at: string;
          duration_minutes: number;
          perceived_effort: number | null;
          note: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          routine_id?: string | null;
          routine_name: string;
          activity_type: string;
          completed_at: string;
          duration_minutes: number;
          perceived_effort?: number | null;
          note?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          routine_id?: string | null;
          routine_name?: string;
          activity_type?: string;
          completed_at?: string;
          duration_minutes?: number;
          perceived_effort?: number | null;
          note?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      exercise_preferences: {
        Row: {
          id: string;
          user_id: string;
          activities: string[];
          days_per_week: number;
          session_minutes: number;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          activities: string[];
          days_per_week: number;
          session_minutes: number;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          activities?: string[];
          days_per_week?: number;
          session_minutes?: number;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      habit_definitions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          weekdays: number[];
          reminder_time: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          weekdays: number[];
          reminder_time?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          weekdays?: number[];
          reminder_time?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      habit_completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          completed_on: string;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          habit_id: string;
          completed_on: string;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          habit_id?: string;
          completed_on?: string;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      wellbeing_checkins: {
        Row: {
          id: string;
          user_id: string;
          checked_on: string;
          mood: number;
          energy: number;
          sleep_quality: number;
          note: string | null;
          revision: number;
          last_operation_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          checked_on: string;
          mood: number;
          energy: number;
          sleep_quality: number;
          note?: string | null;
          revision?: number;
          last_operation_id: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          checked_on?: string;
          mood?: number;
          energy?: number;
          sleep_quality?: number;
          note?: string | null;
          last_operation_id?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      partnerships: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          status: 'active' | 'ended';
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          status?: 'active' | 'ended';
          created_at?: string;
          ended_at?: string | null;
        };
        Update: { status?: 'active' | 'ended'; ended_at?: string | null };
        Relationships: [];
      };
      partner_invites: {
        Row: {
          id: string;
          created_by: string;
          code_hash: string;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          code_hash: string;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: { accepted_by?: string | null; accepted_at?: string | null };
        Relationships: [];
      };
      sharing_grants: {
        Row: {
          id: string;
          owner_user_id: string;
          recipient_user_id: string;
          resource_type: 'weight_progress' | 'routine_library' | 'habit_progress';
          permission: 'view';
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_user_id: string;
          recipient_user_id: string;
          resource_type: 'weight_progress' | 'routine_library' | 'habit_progress';
          permission?: 'view';
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: { permission?: 'view'; revoked_at?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      has_personal_access: { Args: Record<PropertyKey, never>; Returns: boolean };
      create_partner_invite: { Args: Record<PropertyKey, never>; Returns: string };
      accept_partner_invite: { Args: { invite_code: string }; Returns: string };
      list_my_partners: {
        Args: Record<PropertyKey, never>;
        Returns: { partnership_id: string; partner_user_id: string; display_name: string }[];
      };
      get_shared_weight_summary: {
        Args: { target_user: string };
        Returns: {
          current_weight_kg: number;
          first_weight_kg: number;
          target_weight_kg: number | null;
          last_measured_on: string;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
