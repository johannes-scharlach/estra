export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          list_id: string
          parts: Json
          role: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id: string
          list_id: string
          parts?: Json
          role: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          list_id?: string
          parts?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          initial_meal_content_id: string | null
          initial_variant_id: string | null
          list_id: string
          planned_meal_id: string | null
          recipe_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          initial_meal_content_id?: string | null
          initial_variant_id?: string | null
          list_id: string
          planned_meal_id?: string | null
          recipe_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          initial_meal_content_id?: string | null
          initial_variant_id?: string | null
          list_id?: string
          planned_meal_id?: string | null
          recipe_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_initial_variant_id_fkey"
            columns: ["initial_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_planned_meal_id_fkey"
            columns: ["planned_meal_id"]
            isOneToOne: false
            referencedRelation: "planned_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      household_activities: {
        Row: {
          actor_name: string
          actor_user_id: string | null
          closes_at: string | null
          id: string
          item_names: Json | null
          kind: string
          list_id: string
          meal: string | null
          meal_name: string | null
          occurred_at: string
          previous_meal: string | null
          previous_meal_name: string | null
          previous_slot_date: string | null
          slot_date: string | null
        }
        Insert: {
          actor_name: string
          actor_user_id?: string | null
          closes_at?: string | null
          id?: string
          item_names?: Json | null
          kind: string
          list_id: string
          meal?: string | null
          meal_name?: string | null
          occurred_at?: string
          previous_meal?: string | null
          previous_meal_name?: string | null
          previous_slot_date?: string | null
          slot_date?: string | null
        }
        Update: {
          actor_name?: string
          actor_user_id?: string | null
          closes_at?: string | null
          id?: string
          item_names?: Json | null
          kind?: string
          list_id?: string
          meal?: string | null
          meal_name?: string | null
          occurred_at?: string
          previous_meal?: string | null
          previous_meal_name?: string | null
          previous_slot_date?: string | null
          slot_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_activities_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      household_activity_recipients: {
        Row: {
          activity_id: string
          id: string
          list_id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          list_id: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          list_id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_activity_recipients_activity_id_list_id_fkey"
            columns: ["activity_id", "list_id"]
            isOneToOne: false
            referencedRelation: "household_activities"
            referencedColumns: ["id", "list_id"]
          },
          {
            foreignKeyName: "household_activity_recipients_list_id_user_id_fkey"
            columns: ["list_id", "user_id"]
            isOneToOne: false
            referencedRelation: "list_members"
            referencedColumns: ["list_id", "user_id"]
          },
        ]
      }
      household_people: {
        Row: {
          age_group: string
          created_at: string
          diet: string
          diet_other: string
          id: string
          list_id: string
          meal_times: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age_group?: string
          created_at?: string
          diet?: string
          diet_other?: string
          id: string
          list_id: string
          meal_times?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age_group?: string
          created_at?: string
          diet?: string
          diet_other?: string
          id?: string
          list_id?: string
          meal_times?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_people_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "household_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_people_list_id_user_id_fkey"
            columns: ["list_id", "user_id"]
            isOneToOne: true
            referencedRelation: "list_members"
            referencedColumns: ["list_id", "user_id"]
          },
        ]
      }
      household_profiles: {
        Row: {
          created_at: string
          fresh_ingredients: Json
          goals: Json
          id: string
          kitchen_equipment: Json
          main_supermarket: string
          meals_at_home: string
          other_shops: string
          pantry: Json
          restrictions: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fresh_ingredients?: Json
          goals?: Json
          id: string
          kitchen_equipment?: Json
          main_supermarket?: string
          meals_at_home?: string
          other_shops?: string
          pantry?: Json
          restrictions?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fresh_ingredients?: Json
          goals?: Json
          id?: string
          kitchen_equipment?: Json
          main_supermarket?: string
          meals_at_home?: string
          other_shops?: string
          pantry?: Json
          restrictions?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          added_by: string | null
          category_id: string | null
          created_at: string
          id: string
          ingredient_id: number | null
          list_id: string
          name: string
          name_key: string
          planned_meal_id: string | null
          purchase_count: number
          spec: string | null
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          added_by?: string | null
          category_id?: string | null
          created_at?: string
          id: string
          ingredient_id?: number | null
          list_id: string
          name: string
          name_key: string
          planned_meal_id?: string | null
          purchase_count?: number
          spec?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          added_by?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          ingredient_id?: number | null
          list_id?: string
          name?: string
          name_key?: string
          planned_meal_id?: string | null
          purchase_count?: number
          spec?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_planned_meal_id_fkey"
            columns: ["planned_meal_id"]
            isOneToOne: false
            referencedRelation: "planned_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          id: string
          joined_at: string
          list_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          list_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          activity_id: string | null
          attempt_count: number
          created_at: string
          delivered_at: string | null
          device_id: string
          expo_ticket_id: string | null
          id: string
          last_error: string | null
          lease_id: string | null
          lease_until: string | null
          list_id: string
          next_attempt_at: string
          receipt_due_at: string | null
          recipient_id: string | null
          reminder_date: string | null
          status: string
          ticket_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          device_id: string
          expo_ticket_id?: string | null
          id?: string
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          list_id: string
          next_attempt_at?: string
          receipt_due_at?: string | null
          recipient_id?: string | null
          reminder_date?: string | null
          status?: string
          ticket_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          attempt_count?: number
          created_at?: string
          delivered_at?: string | null
          device_id?: string
          expo_ticket_id?: string | null
          id?: string
          last_error?: string | null
          lease_id?: string | null
          lease_until?: string | null
          list_id?: string
          next_attempt_at?: string
          receipt_due_at?: string | null
          recipient_id?: string | null
          reminder_date?: string | null
          status?: string
          ticket_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "household_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "household_activity_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_meals: {
        Row: {
          content_id: string
          created_at: string
          eater_ids: Json
          extra_portions: number
          id: string
          ingredient_swaps: Json
          ingredients_at_home: Json
          list_id: string
          meal: string
          name: string | null
          recipe_id: string | null
          shopping_reviewed_variant_id: string | null
          slot_date: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          content_id?: string
          created_at?: string
          eater_ids?: Json
          extra_portions?: number
          id?: string
          ingredient_swaps?: Json
          ingredients_at_home?: Json
          list_id: string
          meal?: string
          name?: string | null
          recipe_id?: string | null
          shopping_reviewed_variant_id?: string | null
          slot_date: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          eater_ids?: Json
          extra_portions?: number
          id?: string
          ingredient_swaps?: Json
          ingredients_at_home?: Json
          list_id?: string
          meal?: string
          name?: string | null
          recipe_id?: string | null
          shopping_reviewed_variant_id?: string | null
          slot_date?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_meals_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_meals_shopping_reviewed_variant_id_fkey"
            columns: ["shopping_reviewed_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_meals_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          disabled_at: string | null
          disabled_reason: string | null
          expo_push_token: string
          id: string
          installation_id: string
          platform: string
          registered_at: string
          time_zone: string | null
          user_id: string
        }
        Insert: {
          disabled_at?: string | null
          disabled_reason?: string | null
          expo_push_token: string
          id?: string
          installation_id: string
          platform: string
          registered_at?: string
          time_zone?: string | null
          user_id: string
        }
        Update: {
          disabled_at?: string | null
          disabled_reason?: string | null
          expo_push_token?: string
          id?: string
          installation_id?: string
          platform?: string
          registered_at?: string
          time_zone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          from_name: string | null
          from_url: string | null
          id: string
          next_ingredient_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_name?: string | null
          from_url?: string | null
          id?: string
          next_ingredient_id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_name?: string | null
          from_url?: string | null
          id?: string
          next_ingredient_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      variants: {
        Row: {
          content_markdown: string | null
          created_at: string
          description: string | null
          id: string
          ingredient_lines: Json
          instructions: Json
          locale: string
          name: string | null
          recipe_category: string | null
          recipe_cuisine: string | null
          recipe_id: string
          recipe_yield: string | null
          sized_for: Json | null
          total_time: string | null
          updated_at: string
        }
        Insert: {
          content_markdown?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredient_lines?: Json
          instructions?: Json
          locale?: string
          name?: string | null
          recipe_category?: string | null
          recipe_cuisine?: string | null
          recipe_id: string
          recipe_yield?: string | null
          sized_for?: Json | null
          total_time?: string | null
          updated_at?: string
        }
        Update: {
          content_markdown?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ingredient_lines?: Json
          instructions?: Json
          locale?: string
          name?: string | null
          recipe_category?: string | null
          recipe_cuisine?: string | null
          recipe_id?: string
          recipe_yield?: string | null
          sized_for?: Json | null
          total_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variants_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invite: {
        Args: { code: string; person_id?: string; person_name?: string }
        Returns: string
      }
      claim_notification_deliveries: {
        Args: { batch_size?: number; claim_id: string; lease_seconds?: number }
        Returns: {
          activity_id: string
          actor_name: string
          attempt_count: number
          day_meals: Json
          device_id: string
          expo_push_token: string
          expo_ticket_id: string
          household_name: string
          id: string
          item_names: Json
          items_to_buy: number
          kind: string
          list_id: string
          meal: string
          meal_name: string
          previous_meal: string
          previous_meal_name: string
          previous_slot_date: string
          slot_date: string
          status: string
          ticket_sent_at: string
          time_zone: string
          user_id: string
        }[]
      }
      empty_day_reminder_due: {
        Args: { day: string; last_planned: string }
        Returns: boolean
      }
      extend_list_activity: {
        Args: {
          actor: string
          item_name: string
          quiet: string
          target_kind: string
          target_list_id: string
        }
        Returns: undefined
      }
      is_list_member: { Args: { target_list_id: string }; Returns: boolean }
      item_name_key: { Args: { name: string }; Returns: string }
      planned_meal_name: {
        Args: { meal: Database["public"]["Tables"]["planned_meals"]["Row"] }
        Returns: string
      }
      preview_household_invite: { Args: { code: string }; Returns: Json }
      queue_meal_reminders: { Args: { now_at?: string }; Returns: undefined }
      register_push_device: {
        Args: {
          target_expo_push_token: string
          target_installation_id: string
          target_platform: string
          target_time_zone?: string
        }
        Returns: string
      }
      request_notification_dispatch: { Args: never; Returns: undefined }
      reset_household_invite: {
        Args: { target_list_id: string }
        Returns: string
      }
      retract_list_activity: {
        Args: {
          actor: string
          item_name: string
          target_kind: string
          target_list_id: string
        }
        Returns: boolean
      }
      unregister_push_device: {
        Args: { target_installation_id: string; target_reason?: string }
        Returns: undefined
      }
      uuid_for_item: {
        Args: { item_name: string; target_list_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

