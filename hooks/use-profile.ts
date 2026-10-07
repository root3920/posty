'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  organization_id: string;
  role_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
  availability_override: string | null;
  availability_note: string | null;
  role: {
    id: string;
    name: string;
    color: string;
    home_route: string;
  } | null;
  organization: {
    id: string;
    name: string;
    logo_url: string | null;
    brand_color: string;
    currency: string;
    locale: string;
    timezone: string;
    date_format: string;
    tax_rate: number;
    default_check_in_time: string;
    default_check_out_time: string;
    contract_min_nights: number;
    contract_default_payment_day: number;
    contract_default_deposit_months: number;
    contract_provisional_hours: number;
    contact_email: string | null;
  } | null;
}

export function useProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_my_profile');

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as UserProfile | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
