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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          batch_id: string
          created_at: string
          date: string
          id: string
          schedule_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          date: string
          id?: string
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          date?: string
          id?: string
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_students: {
        Row: {
          batch_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          batch_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          batch_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          course_id: string
          created_at: string
          id: string
          max_students: number
          name: string
          organization_id: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          max_students?: number
          name: string
          organization_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          max_students?: number
          name?: string
          organization_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          created_by: string
          daily_hours: number | null
          description: string | null
          duration_days: number | null
          fee: number | null
          grade_level: string | null
          id: string
          includes_speed: boolean | null
          language: string | null
          name: string
          organization_id: string | null
          total_hours: number | null
          updated_at: string
          writing_style: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          daily_hours?: number | null
          description?: string | null
          duration_days?: number | null
          fee?: number | null
          grade_level?: string | null
          id?: string
          includes_speed?: boolean | null
          language?: string | null
          name: string
          organization_id?: string | null
          total_hours?: number | null
          updated_at?: string
          writing_style?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          daily_hours?: number | null
          description?: string | null
          duration_days?: number | null
          fee?: number | null
          grade_level?: string | null
          id?: string
          includes_speed?: boolean | null
          language?: string | null
          name?: string
          organization_id?: string | null
          total_hours?: number | null
          updated_at?: string
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_stats: {
        Row: {
          id: number
          role_counts: Json
          total_batches: number
          total_courses: number
          total_leads: number
          total_orgs: number
          total_payments: number
          total_users: number
          updated_at: string
        }
        Insert: {
          id?: number
          role_counts?: Json
          total_batches?: number
          total_courses?: number
          total_leads?: number
          total_orgs?: number
          total_payments?: number
          total_users?: number
          updated_at?: string
        }
        Update: {
          id?: number
          role_counts?: Json
          total_batches?: number
          total_courses?: number
          total_leads?: number
          total_orgs?: number
          total_payments?: number
          total_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      discovered_rules: {
        Row: {
          created_at: string | null
          description: string | null
          detected_value: number | null
          id: string
          impact_weight: number | null
          metadata: Json | null
          pattern_type: string
          rule_name: string
          status: Database["public"]["Enums"]["rule_status"] | null
          tolerance_max: number | null
          tolerance_min: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          detected_value?: number | null
          id?: string
          impact_weight?: number | null
          metadata?: Json | null
          pattern_type: string
          rule_name: string
          status?: Database["public"]["Enums"]["rule_status"] | null
          tolerance_max?: number | null
          tolerance_min?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          detected_value?: number | null
          id?: string
          impact_weight?: number | null
          metadata?: Json | null
          pattern_type?: string
          rule_name?: string
          status?: Database["public"]["Enums"]["rule_status"] | null
          tolerance_max?: number | null
          tolerance_min?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      font_library: {
        Row: {
          character: string
          created_at: string | null
          display_name: string | null
          id: string
          mean_slant_angle: number | null
          normalized_bezier: Json
          pressure_variance: number | null
          stroke_count: number | null
          updated_at: string | null
          vector_paths: Json
        }
        Insert: {
          character: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          mean_slant_angle?: number | null
          normalized_bezier?: Json
          pressure_variance?: number | null
          stroke_count?: number | null
          updated_at?: string | null
          vector_paths?: Json
        }
        Update: {
          character?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          mean_slant_angle?: number | null
          normalized_bezier?: Json
          pressure_variance?: number | null
          stroke_count?: number | null
          updated_at?: string | null
          vector_paths?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      live_classes: {
        Row: {
          batch_id: string
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string | null
          schedule_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["live_class_status"]
          title: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          schedule_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["live_class_status"]
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string | null
          schedule_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["live_class_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      materials: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          material_type: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          material_type?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          material_type?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          payment_date: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payment_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          payment_date?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          paid_at: string | null
          status: Database["public"]["Enums"]["payroll_status"]
          teacher_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          month: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          teacher_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["payroll_status"]
          teacher_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          batch_id: string
          created_at: string
          date: string | null
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          date?: string | null
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          date?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      stroke_recordings: {
        Row: {
          avg_pressure: number | null
          avg_velocity: number | null
          created_at: string | null
          duration_ms: number | null
          font_library_id: string | null
          id: string
          narration_url: string | null
          slant_angle: number | null
          stroke_data: Json
        }
        Insert: {
          avg_pressure?: number | null
          avg_velocity?: number | null
          created_at?: string | null
          duration_ms?: number | null
          font_library_id?: string | null
          id?: string
          narration_url?: string | null
          slant_angle?: number | null
          stroke_data?: Json
        }
        Update: {
          avg_pressure?: number | null
          avg_velocity?: number | null
          created_at?: string | null
          duration_ms?: number | null
          font_library_id?: string | null
          id?: string
          narration_url?: string | null
          slant_angle?: number | null
          stroke_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "stroke_recordings_font_library_id_fkey"
            columns: ["font_library_id"]
            isOneToOne: false
            referencedRelation: "font_library"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_fonts: {
        Row: {
          created_at: string
          file_url: string
          font_name: string
          id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          font_name: string
          id?: string
        }
        Update: {
          created_at?: string
          file_url?: string
          font_name?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_dashboard_stats: { Args: never; Returns: undefined }
      user_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "admin"
        | "teacher"
        | "student"
        | "parent"
        | "support"
      attendance_status: "present" | "absent" | "late"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      live_class_status: "scheduled" | "live" | "completed" | "cancelled"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      payroll_status: "pending" | "paid"
      rule_status: "pending" | "approved" | "rejected"
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
      app_role: [
        "superadmin",
        "admin",
        "teacher",
        "student",
        "parent",
        "support",
      ],
      attendance_status: ["present", "absent", "late"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      live_class_status: ["scheduled", "live", "completed", "cancelled"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      payroll_status: ["pending", "paid"],
      rule_status: ["pending", "approved", "rejected"],
    },
  },
} as const
