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
      booking_channels: {
        Row: {
          archived_at: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          id: string
          metric_key: string
          month: number
          organization_id: string
          year: number
        }
        Insert: {
          amount: number
          id?: string
          metric_key: string
          month: number
          organization_id: string
          year: number
        }
        Update: {
          amount?: number
          id?: string
          metric_key?: string
          month?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_room_snapshots: {
        Row: {
          available_rooms: number
          id: string
          occupied_rooms: number
          organization_id: string
          out_of_order_rooms: number
          snapshot_date: string
          total_rooms: number
        }
        Insert: {
          available_rooms: number
          id?: string
          occupied_rooms: number
          organization_id: string
          out_of_order_rooms: number
          snapshot_date: string
          total_rooms: number
        }
        Update: {
          available_rooms?: number
          id?: string
          occupied_rooms?: number
          organization_id?: string
          out_of_order_rooms?: number
          snapshot_date?: string
          total_rooms?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_room_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          archived_at: string | null
          code: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          code: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          code?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          archived_at: string | null
          category_group: Database["public"]["Enums"]["expense_category_group"]
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          category_group?: Database["public"]["Enums"]["expense_category_group"]
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          category_group?: Database["public"]["Enums"]["expense_category_group"]
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          expense_date: string
          id: string
          organization_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          supplier: string | null
          tax_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          expense_date: string
          id?: string
          organization_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          supplier?: string | null
          tax_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          expense_date?: string
          id?: string
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          supplier?: string | null
          tax_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folio_charges: {
        Row: {
          description: string
          id: string
          posted_at: string
          posted_by: string | null
          quantity: number
          revenue_center_id: string
          stay_id: string
          tax_rate: number
          total: number | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          posted_at?: string
          posted_by?: string | null
          quantity?: number
          revenue_center_id: string
          stay_id: string
          tax_rate?: number
          total?: number | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          posted_at?: string
          posted_by?: string | null
          quantity?: number
          revenue_center_id?: string
          stay_id?: string
          tax_rate?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "folio_charges_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_charges_revenue_center_id_fkey"
            columns: ["revenue_center_id"]
            isOneToOne: false
            referencedRelation: "revenue_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folio_charges_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "folio_charges_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          birth_date: string | null
          city_of_origin: string | null
          country_of_origin: string | null
          created_at: string
          custom_data: Json | null
          document_number: string | null
          document_type_id: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          document_type_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          document_type_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          organization_id: string
          profile_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id: string
          profile_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          organization_id?: string
          profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_color: string | null
          created_at: string
          currency: string
          date_format: string
          default_check_in_time: string
          default_check_out_time: string
          id: string
          locale: string
          logo_url: string | null
          name: string
          tax_id: string | null
          tax_rate: number
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          tax_id?: string | null
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          tax_id?: string | null
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      other_revenue: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          organization_id: string
          revenue_center_id: string
          revenue_date: string
          tax_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          organization_id: string
          revenue_center_id: string
          revenue_date: string
          tax_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          organization_id?: string
          revenue_center_id?: string
          revenue_date?: string
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "other_revenue_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_revenue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "other_revenue_revenue_center_id_fkey"
            columns: ["revenue_center_id"]
            isOneToOne: false
            referencedRelation: "revenue_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          archived_at: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          method_id: string
          organization_id: string
          paid_at: string
          received_by: string | null
          reference: string | null
          stay_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          method_id: string
          organization_id: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          stay_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          method_id?: string
          organization_id?: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          stay_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "payments_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          description: string
          key: string
          module: string
          scope: string | null
        }
        Insert: {
          action: string
          description: string
          key: string
          module: string
          scope?: string | null
        }
        Update: {
          action?: string
          description?: string
          key?: string
          module?: string
          scope?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability_note: string | null
          availability_override:
            | Database["public"]["Enums"]["availability_status"]
            | null
          avatar_url: string | null
          created_at: string
          custom_data: Json | null
          document_number: string | null
          email: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          job_title: string | null
          organization_id: string
          phone: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          availability_note?: string | null
          availability_override?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          avatar_url?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          organization_id: string
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          availability_note?: string | null
          availability_override?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          avatar_url?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          organization_id?: string
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_centers: {
        Row: {
          archived_at: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          home_route: string
          id: string
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          home_route?: string
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          home_route?: string
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_statuses: {
        Row: {
          archived_at: string | null
          color: string
          counts_as_available: boolean
          counts_as_out_of_order: boolean
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          color?: string
          counts_as_available?: boolean
          counts_as_out_of_order?: boolean
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          color?: string
          counts_as_available?: boolean
          counts_as_out_of_order?: boolean
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: string[] | null
          archived_at: string | null
          base_rate: number
          description: string | null
          id: string
          is_active: boolean
          max_adults: number
          max_children: number
          name: string
          organization_id: string
        }
        Insert: {
          amenities?: string[] | null
          archived_at?: string | null
          base_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          name: string
          organization_id: string
        }
        Update: {
          amenities?: string[] | null
          archived_at?: string | null
          base_rate?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          custom_data: Json | null
          floor: string | null
          housekeeping_status: Database["public"]["Enums"]["housekeeping_status"]
          id: string
          is_active: boolean
          notes: string | null
          number: string
          organization_id: string
          room_type_id: string
          status_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_data?: Json | null
          floor?: string | null
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          is_active?: boolean
          notes?: string | null
          number: string
          organization_id: string
          room_type_id: string
          status_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_data?: Json | null
          floor?: string | null
          housekeeping_status?: Database["public"]["Enums"]["housekeeping_status"]
          id?: string
          is_active?: boolean
          notes?: string | null
          number?: string
          organization_id?: string
          room_type_id?: string
          status_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "room_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          end_time: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          start_time: string
        }
        Insert: {
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          start_time: string
        }
        Update: {
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_guests: {
        Row: {
          guest_id: string
          id: string
          stay_id: string
        }
        Insert: {
          guest_id: string
          id?: string
          stay_id: string
        }
        Update: {
          guest_id?: string
          id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_guests_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "stay_guests_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
        ]
      }
      stays: {
        Row: {
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          adults: number
          channel_id: string | null
          check_in_date: string
          check_out_date: string
          children: number
          code: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          nights: number | null
          notes: string | null
          organization_id: string
          primary_guest_id: string
          rate_per_night: number
          room_id: string
          status: Database["public"]["Enums"]["stay_status"]
          travel_reason_id: string | null
          updated_at: string
        }
        Insert: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          channel_id?: string | null
          check_in_date: string
          check_out_date: string
          children?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          nights?: number | null
          notes?: string | null
          organization_id: string
          primary_guest_id: string
          rate_per_night: number
          room_id: string
          status?: Database["public"]["Enums"]["stay_status"]
          travel_reason_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_check_in_at?: string | null
          actual_check_out_at?: string | null
          adults?: number
          channel_id?: string | null
          check_in_date?: string
          check_out_date?: string
          children?: number
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          nights?: number | null
          notes?: string | null
          organization_id?: string
          primary_guest_id?: string
          rate_per_night?: number
          room_id?: string
          status?: Database["public"]["Enums"]["stay_status"]
          travel_reason_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stays_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "booking_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_primary_guest_id_fkey"
            columns: ["primary_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_travel_reason_id_fkey"
            columns: ["travel_reason_id"]
            isOneToOne: false
            referencedRelation: "travel_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          from_value: string | null
          id: string
          task_id: string
          to_value: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          from_value?: string | null
          id?: string
          task_id: string
          to_value?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          from_value?: string | null
          id?: string
          task_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_links: {
        Row: {
          id: string
          label_id: string
          task_id: string
        }
        Insert: {
          id?: string
          label_id: string
          task_id: string
        }
        Update: {
          id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_links_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          archived_at: string | null
          color: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          archived_at: string | null
          color: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
          type: Database["public"]["Enums"]["task_status_type"]
        }
        Insert: {
          archived_at?: string | null
          color?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
          type?: Database["public"]["Enums"]["task_status_type"]
        }
        Update: {
          archived_at?: string | null
          color?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["task_status_type"]
        }
        Relationships: [
          {
            foreignKeyName: "task_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_data: Json | null
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          organization_id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_rule: string | null
          room_id: string | null
          sort_order: number
          start_date: string | null
          status_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_data?: Json | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          organization_id: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_rule?: string | null
          room_id?: string | null
          sort_order?: number
          start_date?: string | null
          status_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_data?: Json | null
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          organization_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_rule?: string | null
          room_id?: string | null
          sort_order?: number
          start_date?: string | null
          status_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      time_off: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note: string | null
          profile_id: string
          start_date: string
          type: Database["public"]["Enums"]["time_off_type"]
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          profile_id: string
          start_date: string
          type?: Database["public"]["Enums"]["time_off_type"]
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          profile_id?: string
          start_date?: string
          type?: Database["public"]["Enums"]["time_off_type"]
        }
        Relationships: [
          {
            foreignKeyName: "time_off_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_reasons: {
        Row: {
          archived_at: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "travel_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          end_time: string
          id: string
          is_day_off: boolean
          profile_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          is_day_off?: boolean
          profile_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          is_day_off?: boolean
          profile_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      stay_balances: {
        Row: {
          balance: number | null
          organization_id: string | null
          stay_id: string | null
          total_charges: number | null
          total_payments: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_profile: { Args: never; Returns: Json }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      seed_organization_defaults: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      team_task_stats: {
        Args: { p_from: string; p_to: string }
        Returns: {
          completed_count: number
          overdue_count: number
          pending_count: number
          profile_id: string
          stat_date: string
        }[]
      }
    }
    Enums: {
      availability_status: "available" | "busy" | "resting"
      expense_category_group:
        | "departmental"
        | "undistributed"
        | "fixed"
        | "payroll"
      housekeeping_status: "clean" | "dirty" | "inspected"
      payment_status: "paid" | "pending"
      stay_status:
        | "reserved"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      task_priority: "urgent" | "high" | "normal" | "low"
      task_status_type: "open" | "in_progress" | "done" | "cancelled"
      time_off_type: "vacation" | "sick_leave" | "personal" | "other"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {
      availability_status: ["available", "busy", "resting"],
      expense_category_group: [
        "departmental",
        "undistributed",
        "fixed",
        "payroll",
      ],
      housekeeping_status: ["clean", "dirty", "inspected"],
      payment_status: ["paid", "pending"],
      stay_status: [
        "reserved",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      task_priority: ["urgent", "high", "normal", "low"],
      task_status_type: ["open", "in_progress", "done", "cancelled"],
      time_off_type: ["vacation", "sick_leave", "personal", "other"],
    },
  },
} as const
