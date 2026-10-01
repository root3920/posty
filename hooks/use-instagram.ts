'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
      // API returns { profile: { id, username, ... }, tokenExpiresAt }
      const p = data.profile ?? data;
      if (!p.id && !p.username) return null;
      return {
        id: p.id ?? '',
        ig_user_id: p.id ?? '',
        username: p.username ?? null,
        name: p.name ?? null,
        profile_picture_url: p.profile_picture_url ?? null,
        account_type: p.account_type ?? null,
        media_count: p.media_count ?? 0,
        followers_count: p.followers_count ?? 0,
        follows_count: p.follows_count ?? 0,
        status: 'connected',
        token_expires_at: data.tokenExpiresAt ?? '',
        connected_at: '',
      } as InstagramConnection;
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

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ file, aspectRatio }: { file: File; aspectRatio?: string }) => {
      const formData = new FormData();
      formData.append('image', file);
      if (aspectRatio) formData.append('aspectRatio', aspectRatio);

      const res = await fetch('/api/instagram/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al subir la imagen');
      }
      return res.json() as Promise<{ path: string; publicUrl: string }>;
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al subir'),
  });
}

export function usePublishPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { type?: string; caption?: string; media: Array<{ publicUrl: string; altText?: string }> }) => {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al publicar');
      return data as { success: boolean; postId: string; mediaId?: string; permalink?: string };
    },
    onSuccess: (data) => {
      toast.success('¡Publicado en Instagram!');
      queryClient.invalidateQueries({ queryKey: ['instagram_media'] });
      queryClient.invalidateQueries({ queryKey: ['instagram_connection'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al publicar'),
  });
}
