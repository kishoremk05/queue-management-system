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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      company_requests: {
        Row: {
          admin_name: string
          company_name: string
          created_at: string | null
          email: string
          id: string
          paid_at: string | null
          payment_amount: number
          payment_currency: string
          payment_metadata: Json
          payment_provider: string
          payment_reference: string | null
          payment_status: string
          paystack_reference: string | null
          selected_currency: string
          selected_plan: string
          status: string
          user_id: string | null
        }
        Insert: {
          admin_name: string
          company_name: string
          created_at?: string | null
          email: string
          id?: string
          paid_at?: string | null
          payment_amount?: number
          payment_currency?: string
          payment_metadata?: Json
          payment_provider?: string
          payment_reference?: string | null
          payment_status?: string
          paystack_reference?: string | null
          selected_currency?: string
          selected_plan?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          admin_name?: string
          company_name?: string
          created_at?: string | null
          email?: string
          id?: string
          paid_at?: string | null
          payment_amount?: number
          payment_currency?: string
          payment_metadata?: Json
          payment_provider?: string
          payment_reference?: string | null
          payment_status?: string
          paystack_reference?: string | null
          selected_currency?: string
          selected_plan?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      billing_plan_prices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          plan_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          plan_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          amount: number
          created_at: string
          cta: string
          currency: string
          description: string
          features: Json
          highlighted: boolean
          id: string
          is_active: boolean
          name: string
          period_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          cta?: string
          currency?: string
          description: string
          features?: Json
          highlighted?: boolean
          id: string
          is_active?: boolean
          name: string
          period_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          cta?: string
          currency?: string
          description?: string
          features?: Json
          highlighted?: boolean
          id?: string
          is_active?: boolean
          name?: string
          period_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      counters: {
        Row: {
          counter_number: number
          created_at: string | null
          id: string
          organization_id: string
          service_id: string | null
        }
        Insert: {
          counter_number: number
          created_at?: string | null
          id?: string
          organization_id: string
          service_id?: string | null
        }
        Update: {
          counter_number?: number
          created_at?: string | null
          id?: string
          organization_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counters_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      organization_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string
          id: string
          next_billing_at: string | null
          organization_id: string
          payment_provider: string
          payment_reference: string | null
          paystack_customer_code: string | null
          paystack_reference: string | null
          plan_id: string
          request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          next_billing_at?: string | null
          organization_id: string
          payment_provider?: string
          payment_reference?: string | null
          paystack_customer_code?: string | null
          paystack_reference?: string | null
          plan_id: string
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          next_billing_at?: string | null
          organization_id?: string
          payment_provider?: string
          payment_reference?: string | null
          paystack_customer_code?: string | null
          paystack_reference?: string | null
          plan_id?: string
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "company_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          commission_amount: number
          created_at: string
          currency: string
          gateway_fee: number
          gateway_message: string | null
          gross_amount: number
          id: string
          net_amount: number
          paid_at: string | null
          payment_reference: string | null
          paystack_reference: string
          plan_id: string
          provider: string
          raw_response: Json | null
          request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          commission_amount?: number
          created_at?: string
          currency: string
          gateway_fee?: number
          gateway_message?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          payment_reference?: string | null
          paystack_reference: string
          plan_id: string
          provider?: string
          raw_response?: Json | null
          request_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          created_at?: string
          currency?: string
          gateway_fee?: number
          gateway_message?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          paid_at?: string | null
          payment_reference?: string | null
          paystack_reference?: string
          plan_id?: string
          provider?: string
          raw_response?: Json | null
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "company_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_payment_settings: {
        Row: {
          commission_flat_amount: number
          commission_type: string
          commission_value: number
          created_at: string
          default_provider: string
          id: number
          paystack_public_key: string | null
          paystack_secret_key: string | null
          paystack_callback_url: string | null
          paystack_test_mode: boolean
          updated_at: string
        }
        Insert: {
          commission_flat_amount?: number
          commission_type?: string
          commission_value?: number
          created_at?: string
          default_provider?: string
          id?: number
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          paystack_callback_url?: string | null
          paystack_test_mode?: boolean
          updated_at?: string
        }
        Update: {
          commission_flat_amount?: number
          commission_type?: string
          commission_value?: number
          created_at?: string
          default_provider?: string
          id?: number
          paystack_public_key?: string | null
          paystack_secret_key?: string | null
          paystack_callback_url?: string | null
          paystack_test_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          id: string
          section: string
          label: string
          content_type: string
          value: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          section: string
          label: string
          content_type?: string
          value?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section?: string
          label?: string
          content_type?: string
          value?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          organization_id?: string | null
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
      services: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
          prefix: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          prefix?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_requests: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          organization_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          organization_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          counter_id: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          organization_id: string
          priority_level: string
          priority_rank: number
          service_id: string
          notification_channel: string | null
          notification_opt_in: boolean | null
          visit_reason: string | null
          status: string
          token_number: string
        }
        Insert: {
          counter_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          organization_id: string
          notification_channel?: string | null
          notification_opt_in?: boolean | null
          priority_level?: string
          priority_rank?: number
          service_id: string
          visit_reason?: string | null
          status?: string
          token_number: string
        }
        Update: {
          counter_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          organization_id?: string
          notification_channel?: string | null
          notification_opt_in?: boolean | null
          priority_level?: string
          priority_rank?: number
          service_id?: string
          visit_reason?: string | null
          status?: string
          token_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_counter_id_fkey"
            columns: ["counter_id"]
            isOneToOne: false
            referencedRelation: "counters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_token: {
        Args: { _org_id: string; _service_id: string }
        Returns: string
      }
      generate_token_with_priority: {
        Args: { _org_id: string; _priority_level?: string; _service_id: string }
        Returns: string
      }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "company_admin" | "staff"
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
      app_role: ["super_admin", "company_admin", "staff"],
    },
  },
} as const
