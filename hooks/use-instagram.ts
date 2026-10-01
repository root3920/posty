'use client';

import { useQuery } from '@tanstack/react-query';

export interface InstagramConnection {
  id: string;
  ig_user_id: string;
  username: string | null;
  name: string | null;
  profile_picture_url: string | null;
  account_type: string | null;
  media_count: number;
  followers_count: number;
  follows_count: number;
  status: string;
  token_expires_at: string;
  connected_at: string;
}

export interface InstagramMediaItem {
  id: string;
  ig_media_id: string;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  children: Array<{ id: string; media_type: string; media_url: string }> | null;
}

export function useInstagramConnection() {
  return useQuery({
    queryKey: ['instagram_connection'],
    queryFn: async (): Promise<InstagramConnection | null> => {
      const res = await fetch('/api/instagram/profile');
      if (res.status === 404 || res.status === 503) return null;
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.id && !data.ig_user_id) return null;
      return data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useInstagramMedia(cursor?: string) {
  return useQuery({
    queryKey: ['instagram_media', cursor],
    queryFn: async () => {
      let url = '/api/instagram/media';
      if (cursor) url += `?cursor=${cursor}`;
      const res = await fetch(url);
      if (!res.ok) return { media: [], nextCursor: undefined };
      return res.json() as Promise<{ media: InstagramMediaItem[]; nextCursor?: string }>;
    },
    staleTime: 60_000,
  });
}
