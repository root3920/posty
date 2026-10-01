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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_channels: {
        Row: {
          archived_at: string | null
          id: string
          is_active: boolean
          is_ota: boolean
          is_system: boolean
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_ota?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          id?: string
          is_active?: boolean
          is_ota?: boolean
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
      chat_contacts: {
        Row: {
          created_at: string
          custom_name: string | null
          guest_id: string | null
          id: string
          lid: string | null
          organization_id: string
          phone_e164: string | null
          profile_pic_url: string | null
          remote_jid: string | null
          updated_at: string
          visibility: string
          whatsapp_name: string | null
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          guest_id?: string | null
          id?: string
          lid?: string | null
          organization_id: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          remote_jid?: string | null
          updated_at?: string
          visibility?: string
          whatsapp_name?: string | null
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          guest_id?: string | null
          id?: string
          lid?: string | null
          organization_id?: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          remote_jid?: string | null
          updated_at?: string
          visibility?: string
          whatsapp_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_contacts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          assigned_to: string | null
          connection_id: string
          contact_id: string | null
          contact_lid: string | null
          contact_name: string | null
          contact_phone_e164: string
          contact_pic_url: string | null
          created_at: string
          guest_id: string | null
          id: string
          is_hidden: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          organization_id: string
          status: Database["public"]["Enums"]["chat_conversation_status"]
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          connection_id: string
          contact_id?: string | null
          contact_lid?: string | null
          contact_name?: string | null
          contact_phone_e164: string
          contact_pic_url?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          is_hidden?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["chat_conversation_status"]
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          connection_id?: string
          contact_id?: string | null
          contact_lid?: string | null
          contact_name?: string | null
          contact_phone_e164?: string
          contact_pic_url?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          is_hidden?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["chat_conversation_status"]
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "chat_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["chat_message_direction"]
          error: string | null
          external_id: string | null
          id: string
          media_mime: string | null
          media_path: string | null
          organization_id: string
          reply_to_id: string | null
          sent_by: string | null
          sent_from: Database["public"]["Enums"]["chat_message_source"] | null
          status: Database["public"]["Enums"]["chat_message_status"]
          type: Database["public"]["Enums"]["chat_message_type"]
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["chat_message_direction"]
          error?: string | null
          external_id?: string | null
          id?: string
          media_mime?: string | null
          media_path?: string | null
          organization_id: string
          reply_to_id?: string | null
          sent_by?: string | null
          sent_from?: Database["public"]["Enums"]["chat_message_source"] | null
          status?: Database["public"]["Enums"]["chat_message_status"]
          type?: Database["public"]["Enums"]["chat_message_type"]
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["chat_message_direction"]
          error?: string | null
          external_id?: string | null
          id?: string
          media_mime?: string | null
          media_path?: string | null
          organization_id?: string
          reply_to_id?: string | null
          sent_by?: string | null
          sent_from?: Database["public"]["Enums"]["chat_message_source"] | null
          status?: Database["public"]["Enums"]["chat_message_status"]
          type?: Database["public"]["Enums"]["chat_message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notes: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_quick_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          shortcut: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          shortcut?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          shortcut?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_schedules: {
        Row: {
          assigned_role_id: string | null
          assigned_to: string | null
          cleaning_type_id: string
          created_at: string
          created_by: string | null
          default_time: string
          id: string
          instructions: string | null
          is_active: boolean
          organization_id: string
          priority: string
          repeat_end_date: string | null
          repeat_interval: string
          room_id: string
        }
        Insert: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          cleaning_type_id: string
          created_at?: string
          created_by?: string | null
          default_time?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          organization_id: string
          priority?: string
          repeat_end_date?: string | null
          repeat_interval?: string
          room_id: string
        }
        Update: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          cleaning_type_id?: string
          created_at?: string
          created_by?: string | null
          default_time?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          organization_id?: string
          priority?: string
          repeat_end_date?: string | null
          repeat_interval?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedules_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_cleaning_type_id_fkey"
            columns: ["cleaning_type_id"]
            isOneToOne: false
            referencedRelation: "cleaning_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "cleaning_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedules_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_types: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          default_checklist: Json | null
          estimated_minutes: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          requires_inspection: boolean
          sort_order: number
          system_key: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          default_checklist?: Json | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          requires_inspection?: boolean
          sort_order?: number
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          default_checklist?: Json | null
          estimated_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          requires_inspection?: boolean
          sort_order?: number
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_amendments: {
        Row: {
          amendment_number: number
          changes: Json
          contract_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          organization_id: string
          pdf_path: string | null
          previous_values: Json
          reason: string | null
          signed_at: string | null
        }
        Insert: {
          amendment_number: number
          changes?: Json
          contract_id: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          organization_id: string
          pdf_path?: string | null
          previous_values?: Json
          reason?: string | null
          signed_at?: string | null
        }
        Update: {
          amendment_number?: number
          changes?: Json
          contract_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          organization_id?: string
          pdf_path?: string | null
          previous_values?: Json
          reason?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_amendments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_amendments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_amendments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          created_at: string
          doc_type: string
          id: string
          ip_address: string | null
          organization_id: string
          pdf_hash: string | null
          pdf_path: string | null
          sign_token: string | null
          sign_token_expires_at: string | null
          signature_image_path: string | null
          signed_at: string | null
          signer_document: string | null
          signer_name: string | null
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          doc_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          pdf_hash?: string | null
          pdf_path?: string | null
          sign_token?: string | null
          sign_token_expires_at?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_name?: string | null
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          pdf_hash?: string | null
          pdf_path?: string | null
          sign_token?: string | null
          sign_token_expires_at?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_name?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_installments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          is_prorated: boolean
          number: number
          organization_id: string
          paid_amount: number
          paid_at: string | null
          period_end: string
          period_start: string
          prorated_days: number | null
          status: Database["public"]["Enums"]["installment_status"]
          tax_amount: number
          total: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          is_prorated?: boolean
          number: number
          organization_id: string
          paid_amount?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          prorated_days?: number | null
          status?: Database["public"]["Enums"]["installment_status"]
          tax_amount?: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_prorated?: boolean
          number?: number
          organization_id?: string
          paid_amount?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          prorated_days?: number | null
          status?: Database["public"]["Enums"]["installment_status"]
          tax_amount?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          installment_id: string | null
          is_deposit: boolean
          method_id: string
          organization_id: string
          paid_at: string
          received_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          id?: string
          installment_id?: string | null
          is_deposit?: boolean
          method_id: string
          organization_id: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          installment_id?: string | null
          is_deposit?: boolean
          method_id?: string
          organization_id?: string
          paid_at?: string
          received_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "contract_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          cleaning_frequency_days: number
          code: string
          created_at: string
          created_by: string | null
          deposit_amount: number
          deposit_paid_amount: number
          deposit_status: string
          end_date: string
          guest_id: string
          guest_snapshot: Json | null
          id: string
          included_services: string[]
          monthly_rate: number
          notes: string | null
          organization_id: string
          origin_stay_id: string | null
          original_rate: number
          payer_business_name: string | null
          payer_tax_id: string | null
          payment_day: number
          provisional_until: string | null
          renewed_from_id: string | null
          renewed_to_id: string | null
          room_id: string
          room_type_id: string
          signed_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          stay_id: string | null
          tax_rate: number
          terminated_at: string | null
          termination_penalty: number | null
          termination_reason: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cleaning_frequency_days?: number
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_status?: string
          end_date: string
          guest_id: string
          guest_snapshot?: Json | null
          id?: string
          included_services?: string[]
          monthly_rate: number
          notes?: string | null
          organization_id: string
          origin_stay_id?: string | null
          original_rate: number
          payer_business_name?: string | null
          payer_tax_id?: string | null
          payment_day?: number
          provisional_until?: string | null
          renewed_from_id?: string | null
          renewed_to_id?: string | null
          room_id: string
          room_type_id: string
          signed_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          stay_id?: string | null
          tax_rate?: number
          terminated_at?: string | null
          termination_penalty?: number | null
          termination_reason?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          cleaning_frequency_days?: number
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_status?: string
          end_date?: string
          guest_id?: string
          guest_snapshot?: Json | null
          id?: string
          included_services?: string[]
          monthly_rate?: number
          notes?: string | null
          organization_id?: string
          origin_stay_id?: string | null
          original_rate?: number
          payer_business_name?: string | null
          payer_tax_id?: string | null
          payment_day?: number
          provisional_until?: string | null
          renewed_from_id?: string | null
          renewed_to_id?: string | null
          room_id?: string
          room_type_id?: string
          signed_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          stay_id?: string | null
          tax_rate?: number
          terminated_at?: string | null
          termination_penalty?: number | null
          termination_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_origin_stay_id_fkey"
            columns: ["origin_stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "contracts_origin_stay_id_fkey"
            columns: ["origin_stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "contracts_origin_stay_id_fkey"
            columns: ["origin_stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_origin_stay_id_fkey"
            columns: ["origin_stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_to_id_fkey"
            columns: ["renewed_to_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_to_id_fkey"
            columns: ["renewed_to_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
          dian_code: string | null
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
          dian_code?: string | null
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
          dian_code?: string | null
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
      event_booking_history: {
        Row: {
          action: string
          actor_id: string | null
          booking_id: string
          created_at: string
          detail: Json | null
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          booking_id: string
          created_at?: string
          detail?: Json | null
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          detail?: Json | null
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_booking_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "event_bookings_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_booking_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          client_document: string | null
          client_email: string | null
          client_name: string
          client_phone: string
          code: string
          created_at: string
          created_by: string | null
          deposit_method_id: string | null
          deposit_received: number
          deposit_required: number
          deposit_retained_reason: string | null
          deposit_status: Database["public"]["Enums"]["event_deposit_status"]
          end_time: string
          event_date: string
          guest_count: number
          id: string
          is_hotel_guest: boolean
          notes: string | null
          organization_id: string
          rental_paid: boolean
          rental_total: number
          room_number: string | null
          start_time: string
          status: Database["public"]["Enums"]["event_booking_status"]
          updated_at: string
          venue_id: string
        }
        Insert: {
          client_document?: string | null
          client_email?: string | null
          client_name: string
          client_phone: string
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_method_id?: string | null
          deposit_received?: number
          deposit_required?: number
          deposit_retained_reason?: string | null
          deposit_status?: Database["public"]["Enums"]["event_deposit_status"]
          end_time: string
          event_date: string
          guest_count: number
          id?: string
          is_hotel_guest?: boolean
          notes?: string | null
          organization_id: string
          rental_paid?: boolean
          rental_total: number
          room_number?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["event_booking_status"]
          updated_at?: string
          venue_id: string
        }
        Update: {
          client_document?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string
          code?: string
          created_at?: string
          created_by?: string | null
          deposit_method_id?: string | null
          deposit_received?: number
          deposit_required?: number
          deposit_retained_reason?: string | null
          deposit_status?: Database["public"]["Enums"]["event_deposit_status"]
          end_time?: string
          event_date?: string
          guest_count?: number
          id?: string
          is_hotel_guest?: boolean
          notes?: string | null
          organization_id?: string
          rental_paid?: boolean
          rental_total?: number
          room_number?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["event_booking_status"]
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_deposit_method_id_fkey"
            columns: ["deposit_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_venues: {
        Row: {
          close_time: string
          created_at: string
          deposit: number
          description: string | null
          id: string
          is_active: boolean
          max_capacity: number
          name: string
          open_time: string
          organization_id: string
          price: number
          pricing_type: Database["public"]["Enums"]["venue_pricing_type"]
          updated_at: string
        }
        Insert: {
          close_time: string
          created_at?: string
          deposit?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_capacity: number
          name: string
          open_time: string
          organization_id: string
          price: number
          pricing_type: Database["public"]["Enums"]["venue_pricing_type"]
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          deposit?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_capacity?: number
          name?: string
          open_time?: string
          organization_id?: string
          price?: number
          pricing_type?: Database["public"]["Enums"]["venue_pricing_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_venues_organization_id_fkey"
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
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
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
          {
            foreignKeyName: "folio_charges_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_chat_archives: {
        Row: {
          archived_at: string
          archived_by: string | null
          connection_phone: string | null
          guest_id: string
          guest_name: string | null
          id: string
          messages: Json
          organization_id: string
          period_end: string | null
          period_start: string | null
          phone_e164: string | null
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          connection_phone?: string | null
          guest_id: string
          guest_name?: string | null
          id?: string
          messages?: Json
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          phone_e164?: string | null
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          connection_phone?: string | null
          guest_id?: string
          guest_name?: string | null
          id?: string
          messages?: Json
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          phone_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_chat_archives_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_chat_archives_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_chat_archives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address: string | null
          archived_at: string | null
          birth_date: string | null
          city_of_origin: string | null
          country_of_origin: string | null
          created_at: string
          custom_data: Json | null
          document_number: string | null
          document_type_id: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          residence_city: string | null
          residence_country: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          document_type_id?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          residence_city?: string | null
          residence_country?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          birth_date?: string | null
          city_of_origin?: string | null
          country_of_origin?: string | null
          created_at?: string
          custom_data?: Json | null
          document_number?: string | null
          document_type_id?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          residence_city?: string | null
          residence_country?: string | null
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
      housekeeping_config: {
        Row: {
          clean_after_checkout: boolean
          clean_before_arrival: boolean
          created_at: string
          default_time: string
          frequency_days: number
          organization_id: string
          require_inspection: boolean
          skip_pre_arrival_hours: number
          updated_at: string
          vacant_refresh_days: number
        }
        Insert: {
          clean_after_checkout?: boolean
          clean_before_arrival?: boolean
          created_at?: string
          default_time?: string
          frequency_days?: number
          organization_id: string
          require_inspection?: boolean
          skip_pre_arrival_hours?: number
          updated_at?: string
          vacant_refresh_days?: number
        }
        Update: {
          clean_after_checkout?: boolean
          clean_before_arrival?: boolean
          created_at?: string
          default_time?: string
          frequency_days?: number
          organization_id?: string
          require_inspection?: boolean
          skip_pre_arrival_hours?: number
          updated_at?: string
          vacant_refresh_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_api_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          method: string
          organization_id: string
          post_id: string | null
          request_body: Json | null
          response_body: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          method?: string
          organization_id: string
          post_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          method?: string
          organization_id?: string
          post_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_api_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_api_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "instagram_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          access_token_encrypted: string
          account_type: string | null
          connected_at: string
          connected_by: string | null
          created_at: string
          followers_count: number | null
          follows_count: number | null
          id: string
          ig_user_id: string
          media_count: number | null
          name: string | null
          organization_id: string
          profile_picture_url: string | null
          status: string
          token_expires_at: string
          updated_at: string
          username: string | null
        }
        Insert: {
          access_token_encrypted: string
          account_type?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          ig_user_id: string
          media_count?: number | null
          name?: string | null
          organization_id: string
          profile_picture_url?: string | null
          status?: string
          token_expires_at: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          access_token_encrypted?: string
          account_type?: string | null
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          ig_user_id?: string
          media_count?: number | null
          name?: string | null
          organization_id?: string
          profile_picture_url?: string | null
          status?: string
          token_expires_at?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_media: {
        Row: {
          cached_at: string
          caption: string | null
          children: Json | null
          comments_count: number | null
          connection_id: string
          id: string
          ig_media_id: string
          like_count: number | null
          media_type: string | null
          media_url: string | null
          organization_id: string
          permalink: string | null
          thumbnail_url: string | null
          timestamp: string | null
        }
        Insert: {
          cached_at?: string
          caption?: string | null
          children?: Json | null
          comments_count?: number | null
          connection_id: string
          id?: string
          ig_media_id: string
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          organization_id: string
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Update: {
          cached_at?: string
          caption?: string | null
          children?: Json | null
          comments_count?: number | null
          connection_id?: string
          id?: string
          ig_media_id?: string
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          organization_id?: string
          permalink?: string | null
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_media_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          aspect_ratio: string | null
          attempts: number
          caption: string | null
          connection_id: string
          container_id: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          ig_media_id: string | null
          media: Json
          organization_id: string
          permalink: string | null
          published_at: string | null
          scheduled_at: string | null
          status: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          attempts?: number
          caption?: string | null
          connection_id: string
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          ig_media_id?: string | null
          media?: Json
          organization_id: string
          permalink?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          attempts?: number
          caption?: string | null
          connection_id?: string
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          ig_media_id?: string | null
          media?: Json
          organization_id?: string
          permalink?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role_id: string | null
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
          role_id?: string | null
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
          role_id?: string | null
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
          {
            foreignKeyName: "notifications_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accommodation_iva_rate: number
          address: string | null
          brand_color: string | null
          city: string | null
          consumption_tax_rate: number | null
          contract_default_deposit_months: number
          contract_default_payment_day: number
          contract_min_nights: number
          contract_provisional_hours: number
          country_code: string
          created_at: string
          currency: string
          date_format: string
          default_check_in_time: string
          default_check_out_time: string
          department: string | null
          ica_rate: number | null
          id: string
          locale: string
          logo_url: string | null
          name: string
          rnt_category: string | null
          rnt_number: string | null
          sire_enabled: boolean
          tax_id: string | null
          tax_rate: number
          timezone: string
          tra_api_token: string | null
          updated_at: string
        }
        Insert: {
          accommodation_iva_rate?: number
          address?: string | null
          brand_color?: string | null
          city?: string | null
          consumption_tax_rate?: number | null
          contract_default_deposit_months?: number
          contract_default_payment_day?: number
          contract_min_nights?: number
          contract_provisional_hours?: number
          country_code?: string
          created_at?: string
          currency?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          department?: string | null
          ica_rate?: number | null
          id?: string
          locale?: string
          logo_url?: string | null
          name: string
          rnt_category?: string | null
          rnt_number?: string | null
          sire_enabled?: boolean
          tax_id?: string | null
          tax_rate?: number
          timezone?: string
          tra_api_token?: string | null
          updated_at?: string
        }
        Update: {
          accommodation_iva_rate?: number
          address?: string | null
          brand_color?: string | null
          city?: string | null
          consumption_tax_rate?: number | null
          contract_default_deposit_months?: number
          contract_default_payment_day?: number
          contract_min_nights?: number
          contract_provisional_hours?: number
          country_code?: string
          created_at?: string
          currency?: string
          date_format?: string
          default_check_in_time?: string
          default_check_out_time?: string
          department?: string | null
          ica_rate?: number | null
          id?: string
          locale?: string
          logo_url?: string | null
          name?: string
          rnt_category?: string | null
          rnt_number?: string | null
          sire_enabled?: boolean
          tax_id?: string | null
          tax_rate?: number
          timezone?: string
          tra_api_token?: string | null
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
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
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
          {
            foreignKeyName: "payments_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
      recurring_tasks: {
        Row: {
          assigned_profile_id: string | null
          assigned_role_id: string | null
          at_time: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          frequency_config: Json
          frequency_type: string
          id: string
          is_active: boolean
          organization_id: string
          priority: string
          room_id: string | null
          start_date: string | null
          subtasks: Json
          title: string
          updated_at: string
        }
        Insert: {
          assigned_profile_id?: string | null
          assigned_role_id?: string | null
          at_time?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          frequency_config?: Json
          frequency_type: string
          id?: string
          is_active?: boolean
          organization_id: string
          priority?: string
          room_id?: string | null
          start_date?: string | null
          subtasks?: Json
          title: string
          updated_at?: string
        }
        Update: {
          assigned_profile_id?: string | null
          assigned_role_id?: string | null
          at_time?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          frequency_config?: Json
          frequency_type?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          priority?: string
          room_id?: string | null
          start_date?: string | null
          subtasks?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "recurring_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
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
          system_key: string | null
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
          system_key?: string | null
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
          system_key?: string | null
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
      room_cleanings: {
        Row: {
          assigned_role_id: string | null
          assigned_to: string | null
          checklist: Json | null
          cleaning_type_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          inspection_notes: string | null
          inspection_status: Database["public"]["Enums"]["inspection_status"]
          issue_description: string | null
          issues_found: boolean
          minibar_charged: boolean
          notes: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["cleaning_origin"]
          room_id: string
          scheduled_for: string
          skipped_note: string | null
          skipped_reason: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["cleaning_status"]
          stay_id: string | null
          task_id: string | null
        }
        Insert: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          cleaning_type_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_status?: Database["public"]["Enums"]["inspection_status"]
          issue_description?: string | null
          issues_found?: boolean
          minibar_charged?: boolean
          notes?: string | null
          organization_id: string
          origin: Database["public"]["Enums"]["cleaning_origin"]
          room_id: string
          scheduled_for: string
          skipped_note?: string | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          stay_id?: string | null
          task_id?: string | null
        }
        Update: {
          assigned_role_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          cleaning_type_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inspection_notes?: string | null
          inspection_status?: Database["public"]["Enums"]["inspection_status"]
          issue_description?: string | null
          issues_found?: boolean
          minibar_charged?: boolean
          notes?: string | null
          organization_id?: string
          origin?: Database["public"]["Enums"]["cleaning_origin"]
          room_id?: string
          scheduled_for?: string
          skipped_note?: string | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["cleaning_status"]
          stay_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_cleanings_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_cleaning_type_id_fkey"
            columns: ["cleaning_type_id"]
            isOneToOne: false
            referencedRelation: "cleaning_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "room_cleanings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "room_cleanings_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "room_cleanings_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
      room_type_photos: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          organization_id: string
          room_type_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id: string
          room_type_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          organization_id?: string
          room_type_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_type_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_type_photos_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: string[] | null
          archived_at: string | null
          base_rate: number
          bed_config: Json | null
          biweekly_rate: number | null
          code: string | null
          description: string | null
          id: string
          is_active: boolean
          max_adults: number
          max_children: number
          monthly_rate: number | null
          name: string
          organization_id: string
          size_sqm: number | null
          weekly_rate: number | null
        }
        Insert: {
          amenities?: string[] | null
          archived_at?: string | null
          base_rate?: number
          bed_config?: Json | null
          biweekly_rate?: number | null
          code?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          monthly_rate?: number | null
          name: string
          organization_id: string
          size_sqm?: number | null
          weekly_rate?: number | null
        }
        Update: {
          amenities?: string[] | null
          archived_at?: string | null
          base_rate?: number
          bed_config?: Json | null
          biweekly_rate?: number | null
          code?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_adults?: number
          max_children?: number
          monthly_rate?: number | null
          name?: string
          organization_id?: string
          size_sqm?: number | null
          weekly_rate?: number | null
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
          last_cleaned_at: string | null
          last_cleaned_by: string | null
          notes: string | null
          number: string
          organization_id: string
          rate_override: number | null
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
          last_cleaned_at?: string | null
          last_cleaned_by?: string | null
          notes?: string | null
          number: string
          organization_id: string
          rate_override?: number | null
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
          last_cleaned_at?: string | null
          last_cleaned_by?: string | null
          notes?: string | null
          number?: string
          organization_id?: string
          rate_override?: number | null
          room_type_id?: string
          status_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_last_cleaned_by_fkey"
            columns: ["last_cleaned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      sire_submissions: {
        Row: {
          created_at: string
          error_message: string | null
          file_content: string | null
          guest_id: string
          id: string
          organization_id: string
          status: string
          stay_id: string
          submission_type: string
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_content?: string | null
          guest_id: string
          id?: string
          organization_id: string
          status?: string
          stay_id: string
          submission_type: string
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_content?: string | null
          guest_id?: string
          id?: string
          organization_id?: string
          status?: string
          stay_id?: string
          submission_type?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sire_submissions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sire_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sire_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "sire_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "sire_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sire_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
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
          {
            foreignKeyName: "stay_guests_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["stay_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["stay_status"] | null
          organization_id: string
          stay_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["stay_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["stay_status"] | null
          organization_id: string
          stay_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["stay_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["stay_status"] | null
          organization_id?: string
          stay_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_status_history_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "stay_status_history_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "stay_status_history_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_status_history_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
          contract_id: string | null
          converted_from_stay_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          external_invoice_number: string | null
          guest_snapshot: Json | null
          id: string
          nights: number | null
          notes: string | null
          organization_id: string
          primary_guest_id: string
          rate_per_night: number
          room_id: string
          status: Database["public"]["Enums"]["stay_status"]
          stay_type: Database["public"]["Enums"]["stay_type"]
          travel_reason_id: string | null
          updated_at: string
          visit_id: string | null
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
          contract_id?: string | null
          converted_from_stay_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_invoice_number?: string | null
          guest_snapshot?: Json | null
          id?: string
          nights?: number | null
          notes?: string | null
          organization_id: string
          primary_guest_id: string
          rate_per_night: number
          room_id: string
          status?: Database["public"]["Enums"]["stay_status"]
          stay_type?: Database["public"]["Enums"]["stay_type"]
          travel_reason_id?: string | null
          updated_at?: string
          visit_id?: string | null
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
          contract_id?: string | null
          converted_from_stay_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          external_invoice_number?: string | null
          guest_snapshot?: Json | null
          id?: string
          nights?: number | null
          notes?: string | null
          organization_id?: string
          primary_guest_id?: string
          rate_per_night?: number
          room_id?: string
          status?: Database["public"]["Enums"]["stay_status"]
          stay_type?: Database["public"]["Enums"]["stay_type"]
          travel_reason_id?: string | null
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stays_contract"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stays_contract"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "booking_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
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
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
          {
            foreignKeyName: "task_label_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
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
      task_templates: {
        Row: {
          anchor: Database["public"]["Enums"]["template_anchor"]
          at_time: string | null
          conditions: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          offset_days: number
          offset_minutes: number
          organization_id: string
          phase: number | null
          priority: string
          role_system_key: string
          scope: Database["public"]["Enums"]["template_scope"]
          skip_if_past: boolean
          sort_order: number
          subtasks: Json | null
          title_template: string
          updated_at: string
          workflow: Database["public"]["Enums"]["workflow_type"]
        }
        Insert: {
          anchor?: Database["public"]["Enums"]["template_anchor"]
          at_time?: string | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number
          offset_minutes?: number
          organization_id: string
          phase?: number | null
          priority?: string
          role_system_key: string
          scope?: Database["public"]["Enums"]["template_scope"]
          skip_if_past?: boolean
          sort_order?: number
          subtasks?: Json | null
          title_template: string
          updated_at?: string
          workflow: Database["public"]["Enums"]["workflow_type"]
        }
        Update: {
          anchor?: Database["public"]["Enums"]["template_anchor"]
          at_time?: string | null
          conditions?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          offset_days?: number
          offset_minutes?: number
          organization_id?: string
          phase?: number | null
          priority?: string
          role_system_key?: string
          scope?: Database["public"]["Enums"]["template_scope"]
          skip_if_past?: boolean
          sort_order?: number
          subtasks?: Json | null
          title_template?: string
          updated_at?: string
          workflow?: Database["public"]["Enums"]["workflow_type"]
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_organization_id_fkey"
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
          assigned_role_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_data: Json | null
          description: string | null
          digest_date: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          occurrence_date: string | null
          organization_id: string
          parent_task_id: string | null
          phase: number | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_rule: string | null
          recurring_task_id: string | null
          room_id: string | null
          sort_order: number
          source: string
          start_date: string | null
          status_id: string
          stay_id: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_role_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_data?: Json | null
          description?: string | null
          digest_date?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          occurrence_date?: string | null
          organization_id: string
          parent_task_id?: string | null
          phase?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_rule?: string | null
          recurring_task_id?: string | null
          room_id?: string | null
          sort_order?: number
          source?: string
          start_date?: string | null
          status_id: string
          stay_id?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_role_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_data?: Json | null
          description?: string | null
          digest_date?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          occurrence_date?: string | null
          organization_id?: string
          parent_task_id?: string | null
          phase?: number | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_rule?: string | null
          recurring_task_id?: string | null
          room_id?: string | null
          sort_order?: number
          source?: string
          start_date?: string | null
          status_id?: string
          stay_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
      tra_submissions: {
        Row: {
          created_at: string
          error_message: string | null
          guest_id: string
          id: string
          organization_id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          stay_id: string
          submitted_at: string | null
          tra_api_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          guest_id: string
          id?: string
          organization_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          stay_id: string
          submitted_at?: string | null
          tra_api_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          guest_id?: string
          id?: string
          organization_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          stay_id?: string
          submitted_at?: string | null
          tra_api_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tra_submissions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tra_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tra_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "tra_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "tra_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tra_submissions_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
      whatsapp_connections: {
        Row: {
          account_type: Database["public"]["Enums"]["wa_account_type"]
          connected_at: string | null
          connected_by: string | null
          created_at: string
          disconnect_reason: string | null
          disconnected_at: string | null
          display_name: string | null
          id: string
          instance_name: string
          instance_token: string | null
          last_seen_at: string | null
          organization_id: string
          phone_e164: string | null
          profile_pic_url: string | null
          provider: Database["public"]["Enums"]["wa_provider_type"]
          settings: Json
          status: Database["public"]["Enums"]["wa_connection_status"]
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["wa_account_type"]
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          disconnect_reason?: string | null
          disconnected_at?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          instance_token?: string | null
          last_seen_at?: string | null
          organization_id: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: Database["public"]["Enums"]["wa_provider_type"]
          settings?: Json
          status?: Database["public"]["Enums"]["wa_connection_status"]
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["wa_account_type"]
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          disconnect_reason?: string | null
          disconnected_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          instance_token?: string | null
          last_seen_at?: string | null
          organization_id?: string
          phone_e164?: string | null
          profile_pic_url?: string | null
          provider?: Database["public"]["Enums"]["wa_provider_type"]
          settings?: Json
          status?: Database["public"]["Enums"]["wa_connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_logs: {
        Row: {
          connection_id: string | null
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          organization_id: string | null
          payload: Json
          status: Database["public"]["Enums"]["webhook_log_status"]
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload: Json
          status?: Database["public"]["Enums"]["webhook_log_status"]
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["webhook_log_status"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
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
      contracts_view: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          cleaning_frequency_days: number | null
          code: string | null
          created_at: string | null
          created_by: string | null
          deposit_amount: number | null
          deposit_paid_amount: number | null
          deposit_status: string | null
          end_date: string | null
          guest_document_number: string | null
          guest_document_type_code: string | null
          guest_email: string | null
          guest_first_name: string | null
          guest_full_name: string | null
          guest_id: string | null
          guest_last_name: string | null
          guest_phone: string | null
          id: string | null
          included_services: string[] | null
          monthly_rate: number | null
          next_due_amount: number | null
          next_due_date: string | null
          next_due_status: string | null
          notes: string | null
          organization_id: string | null
          original_rate: number | null
          overdue_installments: number | null
          paid_installments: number | null
          payer_business_name: string | null
          payer_tax_id: string | null
          payment_day: number | null
          provisional_until: string | null
          room_floor: string | null
          room_id: string | null
          room_number: string | null
          room_type_id: string | null
          room_type_name: string | null
          signed_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          stay_id: string | null
          tax_rate: number | null
          total_billed: number | null
          total_installments: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings_view: {
        Row: {
          client_document: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          creator_name: string | null
          deposit_method_id: string | null
          deposit_received: number | null
          deposit_required: number | null
          deposit_retained_reason: string | null
          deposit_status:
            | Database["public"]["Enums"]["event_deposit_status"]
            | null
          end_time: string | null
          event_date: string | null
          guest_count: number | null
          id: string | null
          is_hotel_guest: boolean | null
          notes: string | null
          organization_id: string | null
          rental_paid: boolean | null
          rental_total: number | null
          room_number: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["event_booking_status"] | null
          updated_at: string | null
          venue_deposit: number | null
          venue_id: string | null
          venue_max_capacity: number | null
          venue_name: string | null
          venue_price: number | null
          venue_pricing_type:
            | Database["public"]["Enums"]["venue_pricing_type"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "event_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_deposit_method_id_fkey"
            columns: ["deposit_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_view: {
        Row: {
          amount: number | null
          attachment_url: string | null
          category_group_name:
            | Database["public"]["Enums"]["expense_category_group"]
            | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          due_date: string | null
          expense_date: string | null
          id: string | null
          organization_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          supplier: string | null
          tax_amount: number | null
          updated_at: string | null
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
      other_revenue_view: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          id: string | null
          organization_id: string | null
          revenue_center_id: string | null
          revenue_center_name: string | null
          revenue_date: string | null
          tax_amount: number | null
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
      room_cleaning_status_view: {
        Row: {
          check_in_date: string | null
          check_out_date: string | null
          current_stay_id: string | null
          days_since_last: number | null
          floor: string | null
          guest_first_name: string | null
          guest_last_name: string | null
          housekeeping_status:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          is_active: boolean | null
          is_overdue: boolean | null
          last_cleaned_at: string | null
          last_cleaning_at: string | null
          last_cleaning_by_name: string | null
          last_cleaning_id: string | null
          last_cleaning_type_id: string | null
          last_cleaning_type_name: string | null
          next_cleaning_at: string | null
          next_cleaning_id: string | null
          next_cleaning_origin:
            | Database["public"]["Enums"]["cleaning_origin"]
            | null
          next_cleaning_status:
            | Database["public"]["Enums"]["cleaning_status"]
            | null
          next_cleaning_type_id: string | null
          next_cleaning_type_name: string | null
          primary_guest_id: string | null
          room_id: string | null
          room_number: string | null
          room_type_id: string | null
          room_type_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_cleanings_cleaning_type_id_fkey"
            columns: ["next_cleaning_type_id"]
            isOneToOne: false
            referencedRelation: "cleaning_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_cleanings_cleaning_type_id_fkey"
            columns: ["last_cleaning_type_id"]
            isOneToOne: false
            referencedRelation: "cleaning_types"
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
            foreignKeyName: "stays_primary_guest_id_fkey"
            columns: ["primary_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms_view: {
        Row: {
          counts_as_available: boolean | null
          counts_as_out_of_order: boolean | null
          created_at: string | null
          custom_data: Json | null
          floor: string | null
          housekeeping_status:
            | Database["public"]["Enums"]["housekeeping_status"]
            | null
          id: string | null
          is_active: boolean | null
          last_cleaned_at: string | null
          last_cleaned_by: string | null
          max_adults: number | null
          max_children: number | null
          notes: string | null
          number: string | null
          organization_id: string | null
          rate_override: number | null
          room_type_code: string | null
          room_type_id: string | null
          room_type_name: string | null
          room_type_rate: number | null
          status_color: string | null
          status_id: string | null
          status_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_last_cleaned_by_fkey"
            columns: ["last_cleaned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      stays_view: {
        Row: {
          actual_check_in_at: string | null
          actual_check_out_at: string | null
          adults: number | null
          balance: number | null
          channel_id: string | null
          channel_name: string | null
          check_in_date: string | null
          check_out_date: string | null
          children: number | null
          code: string | null
          contract_id: string | null
          converted_from_stay_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          guest_document_number: string | null
          guest_document_type_code: string | null
          guest_email: string | null
          guest_first_name: string | null
          guest_full_name: string | null
          guest_last_name: string | null
          guest_nationality: string | null
          guest_phone: string | null
          guest_snapshot: Json | null
          id: string | null
          nights: number | null
          notes: string | null
          organization_id: string | null
          primary_guest_id: string | null
          rate_per_night: number | null
          room_floor: string | null
          room_id: string | null
          room_number: string | null
          room_type_name: string | null
          room_type_rate: number | null
          status: Database["public"]["Enums"]["stay_status"] | null
          stay_type: Database["public"]["Enums"]["stay_type"] | null
          total_charges: number | null
          total_payments: number | null
          travel_reason_id: string | null
          travel_reason_name: string | null
          updated_at: string | null
          visit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stays_contract"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stays_contract"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "booking_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_converted_from_stay_id_fkey"
            columns: ["converted_from_stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
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
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stays_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
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
      tasks_view: {
        Row: {
          archived_at: string | null
          assigned_role_color: string | null
          assigned_role_id: string | null
          assigned_role_key: string | null
          assigned_role_name: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          custom_data: Json | null
          description: string | null
          digest_date: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string | null
          occurrence_date: string | null
          organization_id: string | null
          parent_task_id: string | null
          phase: number | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          recurrence_rule: string | null
          recurring_task_id: string | null
          room_floor: string | null
          room_id: string | null
          room_number: string | null
          sort_order: number | null
          source: string | null
          start_date: string | null
          status_color: string | null
          status_id: string | null
          status_name: string | null
          status_type: Database["public"]["Enums"]["task_status_type"] | null
          stay_id: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["room_id"]
          },
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_role_id_fkey"
            columns: ["assigned_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
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
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_recurring_task_id_fkey"
            columns: ["recurring_task_id"]
            isOneToOne: false
            referencedRelation: "recurring_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "room_cleaning_status_view"
            referencedColumns: ["current_stay_id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stay_balances"
            referencedColumns: ["stay_id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_stay_id_fkey"
            columns: ["stay_id"]
            isOneToOne: false
            referencedRelation: "stays_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_personal_account_privacy: {
        Args: { p_org_id: string }
        Returns: Json
      }
      assign_conversation: {
        Args: { p_conversation_id: string; p_profile_id?: string }
        Returns: undefined
      }
      assign_task_to_best_person: {
        Args: { p_due_at: string; p_role_id: string; p_task_id: string }
        Returns: string
      }
      available_rooms_by_type: {
        Args: { p_check_in: string; p_check_out: string }
        Returns: {
          available_count: number
          base_rate: number
          id: string
          max_adults: number
          max_children: number
          name: string
        }[]
      }
      available_rooms_for_contract: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          available_count: number
          base_rate: number
          biweekly_rate: number
          first_available_date: string
          id: string
          max_adults: number
          max_children: number
          monthly_rate: number
          name: string
          total_rooms: number
          weekly_rate: number
        }[]
      }
      available_rooms_of_type_for_period: {
        Args: {
          p_end_date: string
          p_room_type_id: string
          p_start_date: string
        }
        Returns: {
          floor: string
          id: string
          number: string
          rate_override: number
        }[]
      }
      backfill_housekeeping_cleanings: { Args: never; Returns: Json }
      cancel_cleaning: {
        Args: { p_cleaning_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_event_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_stay: {
        Args: { p_reason?: string; p_stay_id: string }
        Returns: Json
      }
      change_stay_room: {
        Args: { p_new_room_id: string; p_reason?: string; p_stay_id: string }
        Returns: Json
      }
      change_stay_titular: {
        Args: { p_new_guest_id: string; p_reason?: string; p_stay_id: string }
        Returns: Json
      }
      close_whatsapp_session: {
        Args: {
          p_archive_guests?: boolean
          p_connection_id: string
          p_reason?: string
        }
        Returns: Json
      }
      complete_cleaning: {
        Args: {
          p_checklist?: Json
          p_cleaning_id: string
          p_issue_description?: string
          p_issues_found?: boolean
          p_minibar_charged?: boolean
          p_notes?: string
        }
        Returns: Json
      }
      confirm_guest_arrival: {
        Args: {
          p_document_verified?: boolean
          p_payment_confirmed?: boolean
          p_stay_id: string
        }
        Returns: Json
      }
      convert_long_to_short_stay: {
        Args: {
          p_contract_id: string
          p_new_check_out: string
          p_rate_per_night: number
        }
        Returns: Json
      }
      convert_short_to_long_stay: {
        Args: {
          p_apply_retroactive?: boolean
          p_billing_cycle?: string
          p_cleaning_frequency_days?: number
          p_deposit_amount?: number
          p_end_date: string
          p_included_services?: string[]
          p_monthly_rate: number
          p_payment_day?: number
          p_stay_id: string
          p_tax_rate?: number
        }
        Returns: Json
      }
      create_contract_amendment: {
        Args: {
          p_changes: Json
          p_contract_id: string
          p_effective_date: string
          p_reason?: string
        }
        Returns: Json
      }
      create_contract_with_stay: {
        Args: {
          p_additional_guests?: string[]
          p_billing_cycle?: string
          p_cleaning_frequency_days?: number
          p_deposit_amount?: number
          p_end_date?: string
          p_guest_id: string
          p_included_services?: string[]
          p_monthly_rate?: number
          p_notes?: string
          p_payer_business_name?: string
          p_payer_tax_id?: string
          p_payment_day?: number
          p_room_id?: string
          p_room_type_id?: string
          p_start_date?: string
          p_tax_rate?: number
        }
        Returns: Json
      }
      create_event_booking: {
        Args: {
          p_client_document?: string
          p_client_email?: string
          p_client_name: string
          p_client_phone: string
          p_deposit_method_id?: string
          p_deposit_received?: number
          p_end_time: string
          p_event_date: string
          p_guest_count: number
          p_is_hotel_guest?: boolean
          p_notes?: string
          p_room_number?: string
          p_start_time: string
          p_venue_id: string
        }
        Returns: Json
      }
      create_manual_cleaning: {
        Args: {
          p_assigned_to?: string
          p_cleaning_type_id: string
          p_instructions?: string
          p_priority?: string
          p_replace_weekly?: boolean
          p_room_ids: string[]
          p_scheduled_for: string
        }
        Returns: Json
      }
      create_room_type_with_rooms: {
        Args: {
          p_amenities?: string[]
          p_base_rate?: number
          p_bed_config?: Json
          p_code?: string
          p_description?: string
          p_max_adults?: number
          p_max_children?: number
          p_name: string
          p_photo_paths?: string[]
          p_rooms?: Json
          p_size_sqm?: number
        }
        Returns: Json
      }
      create_stay_with_auto_room: {
        Args: {
          p_adults?: number
          p_channel_id?: string
          p_check_in?: string
          p_check_out?: string
          p_children?: number
          p_guest_address?: string
          p_guest_birth_date?: string
          p_guest_city_of_origin?: string
          p_guest_country_of_origin?: string
          p_guest_document_number?: string
          p_guest_document_type_id?: string
          p_guest_email?: string
          p_guest_first_name?: string
          p_guest_last_name?: string
          p_guest_nationality?: string
          p_guest_notes?: string
          p_guest_phone?: string
          p_notes?: string
          p_rate_per_night?: number
          p_room_id?: string
          p_room_type_id: string
          p_status?: string
          p_travel_reason_id?: string
        }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      delete_imported_non_guest_chats: {
        Args: { p_org_id: string }
        Returns: Json
      }
      ensure_workflow_roles: { Args: { p_org_id: string }; Returns: undefined }
      evaluate_condition: {
        Args: {
          p_channel: Record<string, unknown>
          p_condition: string
          p_guest: Record<string, unknown>
          p_is_same_day: boolean
          p_room_is_inspected: boolean
          p_stay: Record<string, unknown>
        }
        Returns: boolean
      }
      export_sire_file: {
        Args: { p_date_from: string; p_date_to: string }
        Returns: string
      }
      extend_shorten_stay: {
        Args: { p_new_check_out: string; p_reason?: string; p_stay_id: string }
        Returns: Json
      }
      finalize_event_booking: { Args: { p_booking_id: string }; Returns: Json }
      find_duplicate_guests: {
        Args: never
        Returns: {
          guest_a_id: string
          guest_a_name: string
          guest_b_id: string
          guest_b_name: string
          match_type: string
        }[]
      }
      generate_arrived_tasks: { Args: { p_stay_id: string }; Returns: number }
      generate_contract_installments: {
        Args: { p_contract_id: string }
        Returns: undefined
      }
      generate_sire_record: {
        Args: { p_stay_id: string; p_type?: string }
        Returns: Json
      }
      generate_stay_tasks: { Args: { p_stay_id: string }; Returns: number }
      get_audit_log: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          action: string
          actor_name: string
          after: Json
          before: Json
          created_at: string
          id: string
          reason: string
        }[]
      }
      get_chat_unread_count: { Args: never; Returns: number }
      get_contract_kpis: { Args: never; Returns: Json }
      get_cron_jobs: { Args: never; Returns: Json }
      get_cron_run_details: { Args: never; Returns: Json }
      get_event_kpis: { Args: never; Returns: Json }
      get_guest_stats: { Args: { p_guest_id: string }; Returns: Json }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_profile: { Args: never; Returns: Json }
      get_venue_bookings_for_date: {
        Args: { p_date: string; p_venue_id: string }
        Returns: {
          client_name: string
          code: string
          end_time: string
          id: string
          start_time: string
          status: string
        }[]
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      inspect_cleaning: {
        Args: { p_approved: boolean; p_cleaning_id: string; p_notes?: string }
        Returns: Json
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_event_rental_paid: { Args: { p_booking_id: string }; Returns: Json }
      merge_guests: {
        Args: { p_keep_id: string; p_merge_id: string; p_reason?: string }
        Returns: Json
      }
      process_recurring_tasks: { Args: never; Returns: number }
      reassign_workflow_tasks_for_role: {
        Args: { p_org_id: string; p_role_id: string }
        Returns: undefined
      }
      refresh_instagram_tokens: { Args: never; Returns: undefined }
      register_contract_payment: {
        Args: {
          p_amount: number
          p_installment_id: string
          p_method_id: string
          p_reference?: string
        }
        Returns: Json
      }
      register_deposit_payment: {
        Args: {
          p_amount: number
          p_contract_id: string
          p_method_id: string
          p_reference?: string
        }
        Returns: Json
      }
      register_event_deposit: {
        Args: { p_amount: number; p_booking_id: string; p_method_id: string }
        Returns: Json
      }
      register_past_cleaning: {
        Args: {
          p_cleaning_type_id: string
          p_completed_at: string
          p_completed_by?: string
          p_notes?: string
          p_room_id: string
          p_started_at: string
        }
        Returns: Json
      }
      rename_chat_contact: {
        Args: { p_contact_id: string; p_custom_name: string }
        Returns: undefined
      }
      renew_contract: {
        Args: {
          p_contract_id: string
          p_new_end_date: string
          p_new_rate?: number
        }
        Returns: Json
      }
      resolve_title: {
        Args: {
          p_guest: Record<string, unknown>
          p_room: Record<string, unknown>
          p_stay: Record<string, unknown>
          p_template: string
          p_today: string
        }
        Returns: string
      }
      retain_event_deposit: {
        Args: { p_booking_id: string; p_reason: string }
        Returns: Json
      }
      return_event_deposit: { Args: { p_booking_id: string }; Returns: Json }
      schedule_checkout_cleaning: {
        Args: { p_stay_id: string }
        Returns: undefined
      }
      schedule_pre_arrival_cleaning: {
        Args: { p_stay_id: string }
        Returns: undefined
      }
      seed_cleaning_types: { Args: { p_org_id: string }; Returns: undefined }
      seed_default_task_templates: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      seed_housekeeping_config: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      seed_organization_defaults: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      seed_same_day_templates: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      send_contract_for_signature: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      set_contact_visibility: {
        Args: { p_contact_id: string; p_visibility: string }
        Returns: undefined
      }
      set_conversation_status: {
        Args: { p_conversation_id: string; p_status: string }
        Returns: undefined
      }
      set_room_type_monthly_rate: {
        Args: { p_monthly_rate: number; p_room_type_id: string }
        Returns: undefined
      }
      skip_cleaning: {
        Args: { p_cleaning_id: string; p_note?: string; p_reason: string }
        Returns: Json
      }
      snapshot_guest_data: { Args: { p_guest_id: string }; Returns: Json }
      start_cleaning: { Args: { p_cleaning_id: string }; Returns: Json }
      submit_tra: { Args: { p_stay_id: string }; Returns: Json }
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
      terminate_contract: {
        Args: {
          p_contract_id: string
          p_penalty?: number
          p_reason?: string
          p_termination_date: string
        }
        Returns: Json
      }
      update_cleaning: {
        Args: {
          p_assigned_to?: string
          p_cleaning_id: string
          p_cleaning_type_id?: string
          p_notes?: string
          p_scheduled_for?: string
        }
        Returns: Json
      }
      update_stay: {
        Args: {
          p_adults?: number
          p_channel_id?: string
          p_check_in_date?: string
          p_check_out_date?: string
          p_children?: number
          p_notes?: string
          p_rate_per_night?: number
          p_reason?: string
          p_stay_id: string
          p_travel_reason_id?: string
        }
        Returns: Json
      }
      upsert_chat_contact:
        | {
            Args: {
              p_lid?: string
              p_org_id: string
              p_phone?: string
              p_profile_pic?: string
              p_whatsapp_name?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_lid?: string
              p_org_id: string
              p_phone?: string
              p_profile_pic?: string
              p_remote_jid?: string
              p_whatsapp_name?: string
            }
            Returns: string
          }
      upsert_chat_conversation: {
        Args: {
          p_connection_id: string
          p_contact_id: string
          p_contact_name?: string
          p_contact_phone?: string
          p_is_inbound?: boolean
          p_org_id: string
        }
        Returns: string
      }
    }
    Enums: {
      availability_status: "available" | "busy" | "resting"
      billing_cycle: "monthly" | "biweekly" | "weekly"
      chat_conversation_status: "open" | "pending" | "closed"
      chat_message_direction: "in" | "out"
      chat_message_source: "posty" | "phone"
      chat_message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      chat_message_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "contact"
        | "unsupported"
      cleaning_origin:
        | "auto_weekly"
        | "pre_arrival"
        | "checkout"
        | "guest_request"
        | "manual"
      cleaning_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "skipped"
        | "cancelled"
      contract_status:
        | "draft"
        | "sent_for_signature"
        | "signed"
        | "active"
        | "expiring_soon"
        | "finished"
        | "terminated_early"
        | "renewed"
        | "cancelled"
      event_booking_status:
        | "pending_deposit"
        | "confirmed"
        | "finished"
        | "cancelled"
      event_deposit_status: "pending" | "received" | "returned" | "retained"
      expense_category_group:
        | "departmental"
        | "undistributed"
        | "fixed"
        | "payroll"
      housekeeping_status: "clean" | "dirty" | "inspected" | "cleaning"
      inspection_status: "not_required" | "pending" | "approved" | "rejected"
      installment_status: "pending" | "paid" | "partial" | "overdue" | "voided"
      payment_status: "paid" | "pending"
      stay_status:
        | "reserved"
        | "checked_in"
        | "checked_out"
        | "cancelled"
        | "no_show"
      stay_type: "short_stay" | "long_stay"
      task_priority: "urgent" | "high" | "normal" | "low"
      task_status_type: "open" | "in_progress" | "done" | "cancelled"
      template_anchor:
        | "created_at"
        | "check_in"
        | "check_out"
        | "arrival_confirmed"
      template_scope: "per_stay" | "daily_digest"
      time_off_type: "vacation" | "sick_leave" | "personal" | "other"
      venue_pricing_type: "per_hour" | "per_person" | "flat_rate"
      wa_account_type: "personal" | "business"
      wa_connection_status:
        | "pending_qr"
        | "connecting"
        | "connected"
        | "disconnected"
        | "banned"
        | "error"
        | "disconnected_pending"
        | "closed"
      wa_provider_type: "evolution_qr" | "meta_cloud"
      webhook_log_status: "pending" | "processed" | "error"
      workflow_type:
        | "stay_created"
        | "guest_arrived"
        | "payment_confirmed"
        | "precheckin_sent"
        | "precheckin_completed"
        | "room_ready"
        | "in_house_daily"
        | "incident_created"
        | "night_audit"
        | "before_checkout"
        | "express_checkout_requested"
        | "checked_out"
        | "survey_answered"
        | "no_show_event"
        | "cancelled_event"
        | "weekly"
        | "walk_in"
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
      billing_cycle: ["monthly", "biweekly", "weekly"],
      chat_conversation_status: ["open", "pending", "closed"],
      chat_message_direction: ["in", "out"],
      chat_message_source: ["posty", "phone"],
      chat_message_status: ["pending", "sent", "delivered", "read", "failed"],
      chat_message_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "sticker",
        "location",
        "contact",
        "unsupported",
      ],
      cleaning_origin: [
        "auto_weekly",
        "pre_arrival",
        "checkout",
        "guest_request",
        "manual",
      ],
      cleaning_status: [
        "scheduled",
        "in_progress",
        "completed",
        "skipped",
        "cancelled",
      ],
      contract_status: [
        "draft",
        "sent_for_signature",
        "signed",
        "active",
        "expiring_soon",
        "finished",
        "terminated_early",
        "renewed",
        "cancelled",
      ],
      event_booking_status: [
        "pending_deposit",
        "confirmed",
        "finished",
        "cancelled",
      ],
      event_deposit_status: ["pending", "received", "returned", "retained"],
      expense_category_group: [
        "departmental",
        "undistributed",
        "fixed",
        "payroll",
      ],
      housekeeping_status: ["clean", "dirty", "inspected", "cleaning"],
      inspection_status: ["not_required", "pending", "approved", "rejected"],
      installment_status: ["pending", "paid", "partial", "overdue", "voided"],
      payment_status: ["paid", "pending"],
      stay_status: [
        "reserved",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show",
      ],
      stay_type: ["short_stay", "long_stay"],
      task_priority: ["urgent", "high", "normal", "low"],
      task_status_type: ["open", "in_progress", "done", "cancelled"],
      template_anchor: [
        "created_at",
        "check_in",
        "check_out",
        "arrival_confirmed",
      ],
      template_scope: ["per_stay", "daily_digest"],
      time_off_type: ["vacation", "sick_leave", "personal", "other"],
      venue_pricing_type: ["per_hour", "per_person", "flat_rate"],
      wa_account_type: ["personal", "business"],
      wa_connection_status: [
        "pending_qr",
        "connecting",
        "connected",
        "disconnected",
        "banned",
        "error",
        "disconnected_pending",
        "closed",
      ],
      wa_provider_type: ["evolution_qr", "meta_cloud"],
      webhook_log_status: ["pending", "processed", "error"],
      workflow_type: [
        "stay_created",
        "guest_arrived",
        "payment_confirmed",
        "precheckin_sent",
        "precheckin_completed",
        "room_ready",
        "in_house_daily",
        "incident_created",
        "night_audit",
        "before_checkout",
        "express_checkout_requested",
        "checked_out",
        "survey_answered",
        "no_show_event",
        "cancelled_event",
        "weekly",
        "walk_in",
      ],
    },
  },
} as const
