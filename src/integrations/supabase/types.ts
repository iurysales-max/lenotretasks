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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string
          created_at: string
          created_by: string
          description: string | null
          end_at: string
          id: string
          sector_id: string | null
          start_at: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_at: string
          id?: string
          sector_id?: string | null
          start_at: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_at?: string
          id?: string
          sector_id?: string | null
          start_at?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_activities: {
        Row: {
          candidate_id: string
          content: string | null
          created_at: string
          created_by: string
          id: string
          metadata: Json
          type: string
        }
        Insert: {
          candidate_id: string
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          metadata?: Json
          type: string
        }
        Update: {
          candidate_id?: string
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          metadata?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_interviews: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          event_id: string | null
          id: string
          interviewer_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          outcome: string | null
          scheduled_at: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          event_id?: string | null
          id?: string
          interviewer_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          event_id?: string | null
          id?: string
          interviewer_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          outcome?: string | null
          scheduled_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_interviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_status: {
        Row: {
          color: string
          created_at: string
          id: string
          is_terminal: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      candidates: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          email: string | null
          hired_profile_id: string | null
          id: string
          job_title: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          resume_url: string | null
          status_id: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          hired_profile_id?: string | null
          id?: string
          job_title?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          resume_url?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          hired_profile_id?: string | null
          id?: string
          job_title?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          resume_url?: string | null
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_hired_profile_id_fkey"
            columns: ["hired_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "candidate_status"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          done: boolean
          id: string
          position: number
          text: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          text: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "task_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          event_id: string
          user_id: string
        }
        Insert: {
          event_id: string
          user_id: string
        }
        Update: {
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          comment_id: string | null
          context: string | null
          created_at: string
          id: string
          mentioned_by_id: string
          mentioned_user_id: string
          read_at: string | null
          task_id: string | null
        }
        Insert: {
          comment_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          mentioned_by_id: string
          mentioned_user_id: string
          read_at?: string | null
          task_id?: string | null
        }
        Update: {
          comment_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          mentioned_by_id?: string
          mentioned_user_id?: string
          read_at?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      note_shares: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note_id: string
          permission: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note_id: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note_id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived: boolean
          content: Json
          cover_url: string | null
          created_at: string
          icon: string | null
          id: string
          is_private: boolean
          owner_id: string
          parent_id: string | null
          pinned: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          content?: Json
          cover_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_private?: boolean
          owner_id: string
          parent_id?: string | null
          pinned?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          content?: Json
          cover_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_private?: boolean
          owner_id?: string
          parent_id?: string | null
          pinned?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          sector_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email: string
          id: string
          name?: string
          phone?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          sector_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sector_fk"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          responsible_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          responsible_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          responsible_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_favorites: {
        Row: {
          created_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_favorites_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_list_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          permission: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          shared_with_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_done: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_done?: boolean
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_done?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archived: boolean
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          due_time: string | null
          estimated_minutes: number | null
          id: string
          is_private: boolean
          pinned: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          sector_id: string | null
          spent_minutes: number
          status_id: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          is_private?: boolean
          pinned?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          sector_id?: string | null
          spent_minutes?: number
          status_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          is_private?: boolean
          pinned?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          sector_id?: string | null
          spent_minutes?: number
          status_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_candidate: { Args: { _candidate_id: string }; Returns: boolean }
      can_view_event: { Args: { _event_id: string }; Returns: boolean }
      can_view_note: { Args: { _note_id: string }; Returns: boolean }
      can_view_task: { Args: { _task_id: string }; Returns: boolean }
      current_user_sector: { Args: never; Returns: string }
      has_note_access: {
        Args: { _note_id: string; _viewer: string }
        Returns: boolean
      }
      has_note_edit: {
        Args: { _note_id: string; _viewer: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_share_access: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      has_share_edit: {
        Args: { _owner_id: string; _viewer_id: string }
        Returns: boolean
      }
      is_admin_or_rh: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "rh" | "gestor" | "colaborador"
      share_permission: "view" | "edit"
      task_priority: "baixa" | "normal" | "alta" | "urgente"
      user_status: "active" | "inactive"
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
      app_role: ["admin", "rh", "gestor", "colaborador"],
      share_permission: ["view", "edit"],
      task_priority: ["baixa", "normal", "alta", "urgente"],
      user_status: ["active", "inactive"],
    },
  },
} as const
