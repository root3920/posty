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
    onSuccess: () => {
      toast.success('¡Publicado en Instagram!');
      queryClient.invalidateQueries({ queryKey: ['instagram_media'] });
      queryClient.invalidateQueries({ queryKey: ['instagram_connection'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al publicar'),
  });
}

// -------------------------------------------------------
// Scheduled Posts
// -------------------------------------------------------

export interface InstagramPost {
  id: string;
  organization_id: string;
  connection_id: string;
  type: string;
  caption: string | null;
  media: Array<{ publicUrl: string; altText?: string }>;
  aspect_ratio: string | null;
  status: string;
  scheduled_at: string | null;
  container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  published_at: string | null;
  error: string | null;
  last_error_code: string | null;
  attempts: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useInstagramPosts(statusFilter?: string[]) {
  const filterStr = statusFilter?.join(',') ?? 'scheduled,processing,failed,draft';
  return useQuery({
    queryKey: ['instagram_posts', filterStr],
    queryFn: async (): Promise<InstagramPost[]> => {
      const res = await fetch(`/api/instagram/posts?status=${filterStr}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.posts ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function usePublishedPosts() {
  return useQuery({
    queryKey: ['instagram_posts', 'published'],
    queryFn: async (): Promise<InstagramPost[]> => {
      const res = await fetch('/api/instagram/posts?status=published&limit=50');
      if (!res.ok) return [];
      const data = await res.json();
      return data.posts ?? [];
    },
    staleTime: 60_000,
  });
}

export function useSavePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      type?: string;
      caption?: string;
      media: Array<{ publicUrl: string; altText?: string }>;
      aspect_ratio?: string;
      status: 'draft' | 'scheduled';
      scheduled_at?: string;
    }) => {
      const res = await fetch('/api/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      return data.post as { id: string; status: string; scheduled_at: string | null };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instagram_posts'] });
      if (variables.status === 'scheduled') {
        toast.success('Post programado');
      } else {
        toast.success('Borrador guardado');
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al guardar'),
  });
}

export function usePostAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      action: 'reschedule' | 'cancel' | 'to_draft' | 'retry';
      scheduled_at?: string;
    }) => {
      const res = await fetch('/api/instagram/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      return data.post as { id: string; status: string; scheduled_at: string | null };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instagram_posts'] });
      const msgs: Record<string, string> = {
        reschedule: 'Post reprogramado',
        cancel: 'Post cancelado',
        to_draft: 'Movido a borrador',
        retry: 'Reintentando publicación',
      };
      toast.success(msgs[variables.action] ?? 'Actualizado');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error'),
  });
}

export function usePublishNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/instagram/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al publicar');
      return data as { success: boolean; postId: string; mediaId?: string; permalink?: string };
    },
    onSuccess: () => {
      toast.success('¡Publicado en Instagram!');
      queryClient.invalidateQueries({ queryKey: ['instagram_posts'] });
      queryClient.invalidateQueries({ queryKey: ['instagram_media'] });
      queryClient.invalidateQueries({ queryKey: ['instagram_connection'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al publicar'),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/instagram/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar');
      return data;
    },
    onSuccess: () => {
      toast.success('Post eliminado');
      queryClient.invalidateQueries({ queryKey: ['instagram_posts'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al eliminar'),
  });
}

export function useDuplicatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: InstagramPost) => {
      const res = await fetch('/api/instagram/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: post.type,
          caption: post.caption,
          media: post.media,
          aspect_ratio: post.aspect_ratio,
          status: 'draft',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al duplicar');
      return data.post as { id: string; status: string };
    },
    onSuccess: () => {
      toast.success('Post duplicado como borrador');
      queryClient.invalidateQueries({ queryKey: ['instagram_posts'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Error al duplicar'),
  });
}

export interface PublisherHeartbeat {
  active: boolean;
  lastRunAt: string | null;
  secondsAgo: number;
  processed: number;
  errors: number;
}

export function usePublisherHeartbeat() {
  return useQuery({
    queryKey: ['instagram_publisher_heartbeat'],
    queryFn: async (): Promise<PublisherHeartbeat> => {
      const res = await fetch('/api/instagram/heartbeat');
      if (!res.ok) return { active: false, lastRunAt: null, secondsAgo: 999, processed: 0, errors: 0 };
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
