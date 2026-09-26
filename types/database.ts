// Auto-generated from Supabase migrations
// Do not edit manually — regenerate with `npm run db:types`

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // -------------------------------------------------------
      // organizations
      // -------------------------------------------------------
      organizations: {
        Row: {
          id: string
          name: string
          tax_id: string | null
          logo_url: string | null
          brand_color: string
          currency: string
          locale: string
          timezone: string
          date_format: string
          default_check_in_time: string
          default_check_out_time: string
          tax_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tax_id?: string | null
          logo_url?: string | null
          brand_color?: string
          currency?: string
          locale?: string
          timezone?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          tax_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tax_id?: string | null
          logo_url?: string | null
          brand_color?: string
          currency?: string
          locale?: string
          timezone?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          tax_rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // permissions
      // -------------------------------------------------------
      permissions: {
        Row: {
          key: string
          module: string
          action: string
          scope: string | null
          description: string
        }
        Insert: {
          key: string
          module: string
          action: string
          scope?: string | null
          description: string
        }
        Update: {
          key?: string
          module?: string
          action?: string
          scope?: string | null
          description?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // roles
      // -------------------------------------------------------
      roles: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          color: string
          is_system: boolean
          home_route: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          color?: string
          is_system?: boolean
          home_route?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          color?: string
          is_system?: boolean
          home_route?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // role_permissions
      // -------------------------------------------------------
      role_permissions: {
        Row: {
          id: string
          role_id: string
          permission_key: string
        }
        Insert: {
          id?: string
          role_id: string
          permission_key: string
        }
        Update: {
          id?: string
          role_id?: string
          permission_key?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // profiles
      // -------------------------------------------------------
      profiles: {
        Row: {
          id: string
          organization_id: string
          role_id: string | null
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          job_title: string | null
          document_number: string | null
          hire_date: string | null
          is_active: boolean
          availability_override: Database['public']['Enums']['availability_status'] | null
          availability_note: string | null
          custom_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id: string
          role_id?: string | null
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          job_title?: string | null
          document_number?: string | null
          hire_date?: string | null
          is_active?: boolean
          availability_override?: Database['public']['Enums']['availability_status'] | null
          availability_note?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          role_id?: string | null
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          job_title?: string | null
          document_number?: string | null
          hire_date?: string | null
          is_active?: boolean
          availability_override?: Database['public']['Enums']['availability_status'] | null
          availability_note?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_statuses
      // -------------------------------------------------------
      task_statuses: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          sort_order: number
          type: Database['public']['Enums']['task_status_type']
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string
          sort_order?: number
          type?: Database['public']['Enums']['task_status_type']
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          color?: string
          sort_order?: number
          type?: Database['public']['Enums']['task_status_type']
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // room_statuses
      // -------------------------------------------------------
      room_statuses: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          sort_order: number
          counts_as_available: boolean
          counts_as_out_of_order: boolean
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string
          sort_order?: number
          counts_as_available?: boolean
          counts_as_out_of_order?: boolean
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          color?: string
          sort_order?: number
          counts_as_available?: boolean
          counts_as_out_of_order?: boolean
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // room_types
      // -------------------------------------------------------
      room_types: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          base_rate: number
          max_adults: number
          max_children: number
          amenities: string[]
          is_active: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          base_rate?: number
          max_adults?: number
          max_children?: number
          amenities?: string[]
          is_active?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          base_rate?: number
          max_adults?: number
          max_children?: number
          amenities?: string[]
          is_active?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // document_types
      // -------------------------------------------------------
      document_types: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          sort_order: number
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // booking_channels
      // -------------------------------------------------------
      booking_channels: {
        Row: {
          id: string
          organization_id: string
          name: string
          sort_order: number
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // travel_reasons
      // -------------------------------------------------------
      travel_reasons: {
        Row: {
          id: string
          organization_id: string
          name: string
          sort_order: number
          is_active: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          sort_order?: number
          is_active?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // payment_methods
      // -------------------------------------------------------
      payment_methods: {
        Row: {
          id: string
          organization_id: string
          name: string
          sort_order: number
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // revenue_centers
      // -------------------------------------------------------
      revenue_centers: {
        Row: {
          id: string
          organization_id: string
          name: string
          sort_order: number
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // expense_categories
      // -------------------------------------------------------
      expense_categories: {
        Row: {
          id: string
          organization_id: string
          name: string
          category_group: Database['public']['Enums']['expense_category_group']
          sort_order: number
          is_active: boolean
          is_system: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          category_group?: Database['public']['Enums']['expense_category_group']
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          category_group?: Database['public']['Enums']['expense_category_group']
          sort_order?: number
          is_active?: boolean
          is_system?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_labels
      // -------------------------------------------------------
      task_labels: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          is_active: boolean
          archived_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          color?: string
          is_active?: boolean
          archived_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          color?: string
          is_active?: boolean
          archived_at?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // shift_templates
      // -------------------------------------------------------
      shift_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          start_time: string
          end_time: string
          is_active: boolean
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          start_time: string
          end_time: string
          is_active?: boolean
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          start_time?: string
          end_time?: string
          is_active?: boolean
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // work_schedules
      // -------------------------------------------------------
      work_schedules: {
        Row: {
          id: string
          profile_id: string
          weekday: number
          start_time: string
          end_time: string
          is_day_off: boolean
        }
        Insert: {
          id?: string
          profile_id: string
          weekday: number
          start_time: string
          end_time: string
          is_day_off?: boolean
        }
        Update: {
          id?: string
          profile_id?: string
          weekday?: number
          start_time?: string
          end_time?: string
          is_day_off?: boolean
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // time_off
      // -------------------------------------------------------
      time_off: {
        Row: {
          id: string
          profile_id: string
          start_date: string
          end_date: string
          type: Database['public']['Enums']['time_off_type']
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          start_date: string
          end_date: string
          type?: Database['public']['Enums']['time_off_type']
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          start_date?: string
          end_date?: string
          type?: Database['public']['Enums']['time_off_type']
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // tasks
      // -------------------------------------------------------
      tasks: {
        Row: {
          id: string
          organization_id: string
          parent_task_id: string | null
          title: string
          description: string | null
          status_id: string
          priority: Database['public']['Enums']['task_priority']
          created_by: string
          start_date: string | null
          due_date: string | null
          completed_at: string | null
          room_id: string | null
          estimated_minutes: number | null
          sort_order: number
          recurrence_rule: string | null
          custom_data: Json
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          parent_task_id?: string | null
          title: string
          description?: string | null
          status_id: string
          priority?: Database['public']['Enums']['task_priority']
          created_by: string
          start_date?: string | null
          due_date?: string | null
          completed_at?: string | null
          room_id?: string | null
          estimated_minutes?: number | null
          sort_order?: number
          recurrence_rule?: string | null
          custom_data?: Json
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          parent_task_id?: string | null
          title?: string
          description?: string | null
          status_id?: string
          priority?: Database['public']['Enums']['task_priority']
          created_by?: string
          start_date?: string | null
          due_date?: string | null
          completed_at?: string | null
          room_id?: string | null
          estimated_minutes?: number | null
          sort_order?: number
          recurrence_rule?: string | null
          custom_data?: Json
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_assignees
      // -------------------------------------------------------
      task_assignees: {
        Row: {
          id: string
          task_id: string
          profile_id: string
        }
        Insert: {
          id?: string
          task_id: string
          profile_id: string
        }
        Update: {
          id?: string
          task_id?: string
          profile_id?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_label_links
      // -------------------------------------------------------
      task_label_links: {
        Row: {
          id: string
          task_id: string
          label_id: string
        }
        Insert: {
          id?: string
          task_id: string
          label_id: string
        }
        Update: {
          id?: string
          task_id?: string
          label_id?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_comments
      // -------------------------------------------------------
      task_comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // task_activity
      // -------------------------------------------------------
      task_activity: {
        Row: {
          id: string
          task_id: string
          actor_id: string
          action: string
          from_value: string | null
          to_value: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          actor_id: string
          action: string
          from_value?: string | null
          to_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          actor_id?: string
          action?: string
          from_value?: string | null
          to_value?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // rooms
      // -------------------------------------------------------
      rooms: {
        Row: {
          id: string
          organization_id: string
          number: string
          floor: string | null
          room_type_id: string
          status_id: string
          housekeeping_status: Database['public']['Enums']['housekeeping_status']
          notes: string | null
          custom_data: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          number: string
          floor?: string | null
          room_type_id: string
          status_id: string
          housekeeping_status?: Database['public']['Enums']['housekeeping_status']
          notes?: string | null
          custom_data?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          number?: string
          floor?: string | null
          room_type_id?: string
          status_id?: string
          housekeeping_status?: Database['public']['Enums']['housekeeping_status']
          notes?: string | null
          custom_data?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // guests
      // -------------------------------------------------------
      guests: {
        Row: {
          id: string
          organization_id: string
          first_name: string
          last_name: string
          document_type_id: string | null
          document_number: string | null
          nationality: string | null
          birth_date: string | null
          phone: string | null
          email: string | null
          address: string | null
          city_of_origin: string | null
          country_of_origin: string | null
          notes: string | null
          custom_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          first_name: string
          last_name: string
          document_type_id?: string | null
          document_number?: string | null
          nationality?: string | null
          birth_date?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          notes?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          first_name?: string
          last_name?: string
          document_type_id?: string | null
          document_number?: string | null
          nationality?: string | null
          birth_date?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          notes?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // stays
      // nights is a generated column (always stored) — Row only
      // -------------------------------------------------------
      stays: {
        Row: {
          id: string
          organization_id: string
          code: string
          room_id: string
          primary_guest_id: string
          check_in_date: string
          check_out_date: string
          nights: number
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          adults: number
          children: number
          status: Database['public']['Enums']['stay_status']
          channel_id: string | null
          travel_reason_id: string | null
          rate_per_night: number
          currency: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          code?: string
          room_id: string
          primary_guest_id: string
          check_in_date: string
          check_out_date: string
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          children?: number
          status?: Database['public']['Enums']['stay_status']
          channel_id?: string | null
          travel_reason_id?: string | null
          rate_per_night: number
          currency?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          code?: string
          room_id?: string
          primary_guest_id?: string
          check_in_date?: string
          check_out_date?: string
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          children?: number
          status?: Database['public']['Enums']['stay_status']
          channel_id?: string | null
          travel_reason_id?: string | null
          rate_per_night?: number
          currency?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // stay_guests
      // -------------------------------------------------------
      stay_guests: {
        Row: {
          id: string
          stay_id: string
          guest_id: string
        }
        Insert: {
          id?: string
          stay_id: string
          guest_id: string
        }
        Update: {
          id?: string
          stay_id?: string
          guest_id?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // folio_charges
      // total is a generated column (always stored) — Row only
      // -------------------------------------------------------
      folio_charges: {
        Row: {
          id: string
          stay_id: string
          revenue_center_id: string
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          total: number
          posted_at: string
          posted_by: string | null
        }
        Insert: {
          id?: string
          stay_id: string
          revenue_center_id: string
          description: string
          quantity?: number
          unit_price: number
          tax_rate?: number
          posted_at?: string
          posted_by?: string | null
        }
        Update: {
          id?: string
          stay_id?: string
          revenue_center_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          posted_at?: string
          posted_by?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // payments
      // -------------------------------------------------------
      payments: {
        Row: {
          id: string
          stay_id: string | null
          organization_id: string
          amount: number
          method_id: string
          reference: string | null
          paid_at: string
          received_by: string | null
        }
        Insert: {
          id?: string
          stay_id?: string | null
          organization_id: string
          amount: number
          method_id: string
          reference?: string | null
          paid_at?: string
          received_by?: string | null
        }
        Update: {
          id?: string
          stay_id?: string | null
          organization_id?: string
          amount?: number
          method_id?: string
          reference?: string | null
          paid_at?: string
          received_by?: string | null
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // expenses
      // -------------------------------------------------------
      expenses: {
        Row: {
          id: string
          organization_id: string
          category_id: string
          supplier: string | null
          description: string
          amount: number
          tax_amount: number
          expense_date: string
          payment_status: Database['public']['Enums']['payment_status']
          due_date: string | null
          attachment_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category_id: string
          supplier?: string | null
          description: string
          amount: number
          tax_amount?: number
          expense_date: string
          payment_status?: Database['public']['Enums']['payment_status']
          due_date?: string | null
          attachment_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category_id?: string
          supplier?: string | null
          description?: string
          amount?: number
          tax_amount?: number
          expense_date?: string
          payment_status?: Database['public']['Enums']['payment_status']
          due_date?: string | null
          attachment_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // other_revenue
      // -------------------------------------------------------
      other_revenue: {
        Row: {
          id: string
          organization_id: string
          revenue_center_id: string
          description: string
          amount: number
          tax_amount: number
          revenue_date: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          revenue_center_id: string
          description: string
          amount: number
          tax_amount?: number
          revenue_date: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          revenue_center_id?: string
          description?: string
          amount?: number
          tax_amount?: number
          revenue_date?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // budgets
      // -------------------------------------------------------
      budgets: {
        Row: {
          id: string
          organization_id: string
          year: number
          month: number
          metric_key: string
          amount: number
        }
        Insert: {
          id?: string
          organization_id: string
          year: number
          month: number
          metric_key: string
          amount: number
        }
        Update: {
          id?: string
          organization_id?: string
          year?: number
          month?: number
          metric_key?: string
          amount?: number
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // daily_room_snapshots
      // -------------------------------------------------------
      daily_room_snapshots: {
        Row: {
          id: string
          organization_id: string
          snapshot_date: string
          total_rooms: number
          available_rooms: number
          occupied_rooms: number
          out_of_order_rooms: number
        }
        Insert: {
          id?: string
          organization_id: string
          snapshot_date: string
          total_rooms: number
          available_rooms: number
          occupied_rooms: number
          out_of_order_rooms: number
        }
        Update: {
          id?: string
          organization_id?: string
          snapshot_date?: string
          total_rooms?: number
          available_rooms?: number
          occupied_rooms?: number
          out_of_order_rooms?: number
        }
        Relationships: []
      }

      // -------------------------------------------------------
      // notifications
      // -------------------------------------------------------
      notifications: {
        Row: {
          id: string
          profile_id: string
          organization_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          organization_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          organization_id?: string
          type?: string
          title?: string
          body?: string | null
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      // -------------------------------------------------------
      // stay_balances
      // -------------------------------------------------------
      stay_balances: {
        Row: {
          stay_id: string
          organization_id: string
          total_charges: number
          total_payments: number
          balance: number
        }
        Relationships: []
      }
    }

    Functions: {
      // Returns the current user's profile as JSON, including role and organization
      get_my_profile: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }

      // Returns an array of permission keys for the current user
      get_my_permissions: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }

      // Returns true if the current user's role has the given permission key
      has_permission: {
        Args: { p_key: string }
        Returns: boolean
      }

      // Seeds all default catalog rows for a newly created organization
      seed_organization_defaults: {
        Args: { p_org_id: string }
        Returns: void
      }

      // Returns task counts per employee per day in the given date range
      team_task_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          profile_id: string
          stat_date: string
          pending_count: number
          completed_count: number
          overdue_count: number
        }[]
      }
    }

    Enums: {
      availability_status: 'available' | 'busy' | 'resting'
      task_status_type: 'open' | 'in_progress' | 'done' | 'cancelled'
      task_priority: 'urgent' | 'high' | 'normal' | 'low'
      time_off_type: 'vacation' | 'sick_leave' | 'personal' | 'other'
      housekeeping_status: 'clean' | 'dirty' | 'inspected'
      stay_status: 'reserved' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
      expense_category_group: 'departmental' | 'undistributed' | 'fixed' | 'payroll'
      payment_status: 'paid' | 'pending'
    }

    CompositeTypes: Record<string, never>
  }
}

// -------------------------------------------------------
// Convenience re-exports for common row types
// -------------------------------------------------------
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
