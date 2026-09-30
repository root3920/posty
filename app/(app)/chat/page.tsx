'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Check,
  CheckCheck,
  Wifi,
  WifiOff,
  Search,
  Loader2,
  Plus,
  X,
  Image as ImageIcon,
  FileText,
  Mic,
  MapPin,
  User,
  MoreHorizontal,
  StickyNote,
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  useWhatsAppConnection,
  useChatConversations,
  useChatMessages,
  useChatNotes,
  useChatQuickReplies,
  useMarkConversationRead,
  useAssignConversation,
  useSetConversationStatus,
  useAddChatNote,
  type ChatConversation,
  type ChatMessage,
  type ChatNote,
} from '@/hooks/use-chat';
import { useProfile } from '@/hooks/use-profile';
import { GuestContextPanel } from '@/components/chat/guest-context-panel';
import { cn } from '@/lib/utils';
import { formatPhoneNumberIntl } from 'react-phone-number-input';

// -------------------------------------------------------
// Utilities
// -------------------------------------------------------

function formatPhone(phone: string): string {
  try {
    return formatPhoneNumberIntl(phone as `+${string}`) || phone;
  } catch {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const local = digits.slice(-10);
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    return phone;
  }
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ayer';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: es });
  return format(date, 'dd/MM/yy');
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  return format(date, "EEEE d MMM", { locale: es });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// -------------------------------------------------------
// Filter types
// -------------------------------------------------------

type FilterKey = 'all' | 'unread' | 'mine' | 'unassigned' | 'closed';

interface FilterChip {
  key: FilterKey;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'No leídos' },
  { key: 'mine', label: 'Míos' },
  { key: 'unassigned', label: 'Sin asignar' },
  { key: 'closed', label: 'Cerrados' },
];

// -------------------------------------------------------
// Status ticks
// -------------------------------------------------------

function StatusTicks({ status }: { status: string }) {
  if (status === 'pending') return <Check className="h-3 w-3 text-primary-foreground/60" />;
  if (status === 'sent') return <CheckCheck className="h-3 w-3 text-primary-foreground/60" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 text-primary-foreground/60" />;
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-blue-300" />;
  return null;
}

// -------------------------------------------------------
// Media renderer
// -------------------------------------------------------

function MediaContent({ type, mediaPath, body }: { type: string; mediaPath: string | null; body: string | null }) {
  if (type === 'image') {
    return (
      <div className="space-y-1">
        {mediaPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaPath} alt="Imagen" className="max-w-[200px] rounded-lg" />
        ) : (
          <div className="flex items-center gap-1.5 opacity-70">
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs">Imagen</span>
          </div>
        )}
        {body && <p className="text-xs opacity-80">{body}</p>}
      </div>
    );
  }
  if (type === 'audio') {
    return (
      <div className="flex items-center gap-1.5 opacity-70">
        <Mic className="h-4 w-4" />
        <span className="text-xs">Audio</span>
      </div>
    );
  }
  if (type === 'video') {
    return (
      <div className="flex items-center gap-1.5 opacity-70">
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs">Video</span>
      </div>
    );
  }
  if (type === 'document') {
    return (
      <div className="flex items-center gap-1.5 opacity-70">
        <FileText className="h-4 w-4" />
        <span className="text-xs">{body ?? 'Documento'}</span>
      </div>
    );
  }
  if (type === 'location') {
    return (
      <div className="flex items-center gap-1.5 opacity-70">
        <MapPin className="h-4 w-4" />
        <span className="text-xs">Ubicación</span>
      </div>
    );
  }
  if (type === 'sticker') {
    return (
      <div className="flex items-center gap-1.5 opacity-70">
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs">Sticker</span>
      </div>
    );
  }
  if (type === 'unsupported') {
    return <p className="text-xs italic opacity-60">Mensaje no disponible en POSTY</p>;
  }
  // text / default
  return <p className="whitespace-pre-wrap break-words">{body ?? '(sin contenido)'}</p>;
}

// -------------------------------------------------------
// Message bubble
// -------------------------------------------------------

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isOut = msg.direction === 'out';
  const timeLabel = format(new Date(msg.created_at), 'HH:mm');

  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-xs',
          isOut
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        <MediaContent type={msg.type} mediaPath={msg.media_path} body={msg.body} />
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px]',
            isOut ? 'justify-end text-primary-foreground/70' : 'justify-end text-muted-foreground',
          )}
        >
          {isOut && msg.sent_from === 'phone' && (
            <span className="mr-1 rounded bg-black/10 px-1 py-px text-[10px]">
              Desde el celular
            </span>
          )}
          <span>{timeLabel}</span>
          {isOut && <StatusTicks status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Note bubble
// -------------------------------------------------------

function NoteBubble({ note }: { note: ChatNote }) {
  const timeLabel = format(new Date(note.created_at), 'HH:mm');

  return (
    <div className="flex justify-center">
      <div className="max-w-[85%] rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm dark:border-amber-800/40 dark:bg-amber-950/30">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <StickyNote className="h-3 w-3" />
          <span>Nota interna · {note.author_name ?? 'Usuario'}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-amber-900 dark:text-amber-200">
          {note.body}
        </p>
        <p className="mt-1 text-right text-[11px] text-amber-600/70 dark:text-amber-500/70">
          {timeLabel}
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Date separator
// -------------------------------------------------------

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-muted-foreground">
        {formatDateSeparator(dateStr)}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// -------------------------------------------------------
// No connection empty state
// -------------------------------------------------------

function NoConnectionEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-heading text-lg font-semibold">
          Conecta WhatsApp para empezar a chatear
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vincula el número de WhatsApp de tu hotel y gestiona todas las conversaciones desde aquí.
        </p>
      </div>
      <Button onClick={() => (window.location.href = '/configuracion/whatsapp')}>
        Conectar WhatsApp
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// New chat dialog (inline popover)
// -------------------------------------------------------

interface NewChatDialogProps {
  onClose: () => void;
}

function NewChatDialog({ onClose }: NewChatDialogProps) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    const trimmedMsg = message.trim();
    if (!trimmedPhone || !trimmedMsg) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone, text: trimmedMsg }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'No se pudo enviar');
      }
      toast.success('Mensaje enviado');
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium">Nuevo chat</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Teléfono (con código de país)</label>
          <Input
            placeholder="+57 300 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-9 text-sm"
            style={{ fontSize: '16px' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Mensaje</label>
          <Textarea
            placeholder="Escribe el primer mensaje…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            style={{ fontSize: '16px' }}
          />
        </div>
        <Button type="submit" size="sm" className="w-full" disabled={!phone.trim() || !message.trim() || isSending}>
          {isSending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          Enviar
        </Button>
      </form>
    </div>
  );
}

// -------------------------------------------------------
// Conversation list item
// -------------------------------------------------------

function ConversationItem({
  conv,
  selected,
  onClick,
}: {
  conv: ChatConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const displayName = conv.contact_name || formatPhone(conv.contact_phone_e164);
  const initials = displayName.charAt(0).toUpperCase() || '#';
  const timeLabel = conv.last_message_at ? formatMessageTime(conv.last_message_at) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        selected && 'border-l-2 border-primary bg-primary/10 hover:bg-primary/10',
        !selected && 'border-l-2 border-transparent',
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {initials}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{timeLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conv.last_message_preview ?? 'Sin mensajes'}
          </p>
          {conv.unread_count > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// -------------------------------------------------------
// Conversations column
// -------------------------------------------------------

interface ConversationsColumnProps {
  conversations: ChatConversation[];
  allConversations: ChatConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onImport?: () => void;
  isImporting?: boolean;
  activeFilter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  currentUserId: string | null;
}

function ConversationsColumn({
  conversations,
  allConversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  onImport,
  isImporting,
  activeFilter,
  onFilterChange,
  currentUserId,
}: ConversationsColumnProps) {
  const [showNewChat, setShowNewChat] = useState(false);

  // Client-side filter application
  const filtered = conversations.filter((c) => {
    // mine filter
    if (activeFilter === 'mine') return c.assigned_to === currentUserId;
    // unassigned filter
    if (activeFilter === 'unassigned') return c.assigned_to === null;
    return true;
  }).filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (c.contact_name ?? '').toLowerCase().includes(q) ||
      c.contact_phone_e164.includes(q)
    );
  });

  // Count per filter
  function countFilter(key: FilterKey): number {
    if (key === 'all') return allConversations.length;
    if (key === 'unread') return allConversations.filter((c) => c.unread_count > 0).length;
    if (key === 'mine') return allConversations.filter((c) => c.assigned_to === currentUserId).length;
    if (key === 'unassigned') return allConversations.filter((c) => c.assigned_to === null).length;
    if (key === 'closed') return allConversations.filter((c) => c.status === 'closed').length;
    return 0;
  }

  return (
    <div className="flex h-full flex-col border-r">
      {/* Header */}
      <div className="shrink-0 border-b px-4 pb-2 pt-3">
        <div className="relative flex items-center justify-between">
          <span className="font-heading text-base font-semibold">
            Conversaciones
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {conversations.length}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            {onImport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onImport}
                disabled={isImporting}
              >
                {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Importar'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => setShowNewChat((v) => !v)}
              aria-label="Nuevo chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {showNewChat && <NewChatDialog onClose={() => setShowNewChat(false)} />}
        </div>

        {/* Filter chips */}
        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
          {FILTER_CHIPS.map((chip) => {
            const count = countFilter(chip.key);
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onFilterChange(chip.key)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  activeFilter === chip.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {chip.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1 text-[10px]',
                      activeFilter === chip.key
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-background text-muted-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversación…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p>{searchQuery ? 'Sin resultados' : 'Sin conversaciones'}</p>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={onImport}
                disabled={isImporting}
              >
                {isImporting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                Importar chats recientes
              </Button>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              selected={selectedId === conv.id}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Quick reply dropdown
// -------------------------------------------------------

interface QuickRepliesDropdownProps {
  items: Array<{ id: string; title: string; body: string; shortcut: string | null }>;
  onSelect: (body: string) => void;
  onClose: () => void;
}

function QuickRepliesDropdown({ items, onSelect, onClose }: QuickRepliesDropdownProps) {
  if (items.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-48 overflow-y-auto rounded-xl border bg-background shadow-lg">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.body);
            onClose();
          }}
          className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-muted"
        >
          <span className="text-xs font-medium">{item.title}</span>
          <span className="truncate text-xs text-muted-foreground">{item.body}</span>
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------
// Messages column
// -------------------------------------------------------

interface MessagesColumnProps {
  conversationId: string | null;
  conversations: ChatConversation[];
  onBack?: () => void;
  showBackButton?: boolean;
  currentUserId: string | null;
}

function MessagesColumn({
  conversationId,
  conversations,
  onBack,
  showBackButton,
  currentUserId,
}: MessagesColumnProps) {
  const [inputTab, setInputTab] = useState<'message' | 'note'>('message');
  const [text, setText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useChatMessages(conversationId);
  const { data: notes = [] } = useChatNotes(conversationId);
  const { data: quickReplies = [] } = useChatQuickReplies();
  const addNote = useAddChatNote();
  const assignConversation = useAssignConversation();
  const setStatus = useSetConversationStatus();

  const selectedConversation = conversations.find((c) => c.id === conversationId);
  const displayName = selectedConversation
    ? selectedConversation.contact_name || formatPhone(selectedConversation.contact_phone_e164)
    : null;
  const displayPhone = selectedConversation
    ? formatPhone(selectedConversation.contact_phone_e164)
    : null;

  // Interleave messages and notes by created_at
  type TimelineItem =
    | { kind: 'message'; data: ChatMessage }
    | { kind: 'note'; data: ChatNote };

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, data: m })),
    ...notes.map((n) => ({ kind: 'note' as const, data: n })),
  ].sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length]);

  const handleSend = useCallback(async () => {
    const body = text.trim();
    if (!body || !conversationId || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, text: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'No se pudo enviar el mensaje');
      }
      setText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setIsSending(false);
    }
  }, [text, conversationId, isSending]);

  const handleSaveNote = useCallback(async () => {
    const body = noteText.trim();
    if (!body || !conversationId) return;
    await addNote.mutateAsync({ conversationId, body });
    setNoteText('');
  }, [noteText, conversationId, addNote]);

  const handleMessageKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleNoteKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSaveNote();
      }
    },
    [handleSaveNote],
  );

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      setShowQuickReplies(value.startsWith('/'));
    },
    [],
  );

  if (!conversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <MessageCircle className="h-10 w-10 opacity-30" />
        <p className="text-sm">Selecciona una conversación</p>
      </div>
    );
  }

  const isClosed = selectedConversation?.status === 'closed';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        {showBackButton && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {displayName?.charAt(0).toUpperCase() ?? <User className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName ?? 'Contacto'}</p>
          {selectedConversation && displayPhone && (
            <p className="text-xs text-muted-foreground">{displayPhone}</p>
          )}
        </div>

        {/* Status badge */}
        {isClosed && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            Cerrado
          </Badge>
        )}

        {/* Close/Reopen button */}
        {selectedConversation && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() =>
              setStatus.mutate({
                conversationId: selectedConversation.id,
                status: isClosed ? 'open' : 'closed',
              })
            }
            disabled={setStatus.isPending}
          >
            {setStatus.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isClosed ? (
              'Reabrir'
            ) : (
              'Cerrar'
            )}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 px-4 py-4">
          {timeline.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Sin mensajes aún</div>
          ) : (
            timeline.map((item, idx) => {
              const prevItem = idx > 0 ? timeline[idx - 1] : null;
              const showSep =
                !prevItem || !isSameDay(prevItem.data.created_at, item.data.created_at);
              return (
                <div key={item.data.id}>
                  {showSep && <DateSeparator dateStr={item.data.created_at} />}
                  {item.kind === 'message' ? (
                    <MessageBubble msg={item.data as ChatMessage} />
                  ) : (
                    <NoteBubble note={item.data as ChatNote} />
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        {/* Tabs */}
        <div className="mb-2 flex gap-1">
          <button
            type="button"
            onClick={() => setInputTab('message')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              inputTab === 'message'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Mensaje
          </button>
          <button
            type="button"
            onClick={() => setInputTab('note')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              inputTab === 'note'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Nota interna
          </button>
        </div>

        {inputTab === 'message' ? (
          <div className="relative">
            {showQuickReplies && (
              <QuickRepliesDropdown
                items={quickReplies}
                onSelect={(body) => setText(body)}
                onClose={() => setShowQuickReplies(false)}
              />
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder={isClosed ? 'Conversación cerrada' : 'Escribe un mensaje… (/ para respuestas rápidas)'}
                rows={1}
                disabled={isClosed}
                className={cn(
                  'flex-1 resize-none rounded-xl border bg-muted/40 px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40',
                  'min-h-[44px] max-h-32 overflow-y-auto',
                  isClosed && 'cursor-not-allowed opacity-50',
                )}
                style={{ fontSize: '16px' }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!text.trim() || isSending || isClosed}
                aria-label="Enviar"
                className="h-10 w-10 shrink-0 rounded-full"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Enter para enviar · Shift + Enter para nueva línea
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                placeholder="Escribe una nota interna (solo el equipo la verá)…"
                rows={2}
                className="flex-1 resize-none rounded-xl border bg-amber-50/50 px-3 py-2 text-sm focus:ring-amber-400/40 dark:bg-amber-950/20"
                style={{ fontSize: '16px' }}
              />
              <Button
                size="icon"
                onClick={handleSaveNote}
                disabled={!noteText.trim() || addNote.isPending}
                aria-label="Guardar nota"
                className="h-10 w-10 shrink-0 rounded-full bg-amber-500 text-white hover:bg-amber-600"
              >
                {addNote.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StickyNote className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-amber-700/70 dark:text-amber-500/70">
              Enter para guardar · Solo visible para el equipo
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Connected chat view
// -------------------------------------------------------

interface ConnectedChatProps {
  connection: {
    status: string;
    connected: boolean;
    displayName: string | null;
    phone: string | null;
  };
}

function ConnectedChat({ connection }: ConnectedChatProps) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobileMessageView, setIsMobileMessageView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const currentUserId = profile?.id ?? null;

  const markRead = useMarkConversationRead();

  // Get all conversations for counts (no filter for server-side, we do client-side for mine/unassigned)
  const { data: allConversations = [] } = useChatConversations();
  const { data: unreadConversations = [] } = useChatConversations({ unreadOnly: true });
  const { data: closedConversations = [] } = useChatConversations({ status: 'closed' });

  // Map activeFilter to useChatConversations params
  function getFilterParams(key: FilterKey): Parameters<typeof useChatConversations>[0] {
    if (key === 'unread') return { unreadOnly: true };
    if (key === 'closed') return { status: 'closed' };
    // 'mine' and 'unassigned' are filtered client-side from the 'all' result
    return undefined;
  }

  const { data: filteredConversations = [] } = useChatConversations(getFilterParams(activeFilter));

  const selectedConv = allConversations.find((c) => c.id === selectedId) ?? null;

  async function handleImport() {
    setIsImporting(true);
    try {
      const res = await fetch('/api/whatsapp/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al importar');
      toast.success(
        `${data.chats} chats importados${data.namesUpdated ? ` · ${data.namesUpdated} nombres actualizados` : ''}`,
      );
      queryClient.invalidateQueries({ queryKey: ['chat_conversations'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar chats');
    } finally {
      setIsImporting(false);
    }
  }

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (isMobile) setIsMobileMessageView(true);
      markRead.mutate(id);
    },
    [isMobile, markRead],
  );

  const handleBack = useCallback(() => {
    setIsMobileMessageView(false);
  }, []);

  const isConnected = connection.connected === true;

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs',
          isConnected
            ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400',
        )}
      >
        {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span>
          {isConnected
            ? `Conectado${connection.displayName ? ` · ${connection.displayName}` : ''}${connection.phone ? ` · ${formatPhone(connection.phone)}` : ''}`
            : 'Sin conexión — reconectando…'}
        </span>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {isMobile ? (
          isMobileMessageView ? (
            <div className="flex h-full w-full flex-col">
              <MessagesColumn
                conversationId={selectedId}
                conversations={allConversations}
                onBack={handleBack}
                showBackButton
                currentUserId={currentUserId}
              />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col">
              <ConversationsColumn
                conversations={filteredConversations}
                allConversations={allConversations}
                selectedId={selectedId}
                onSelect={handleSelectConversation}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onImport={handleImport}
                isImporting={isImporting}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                currentUserId={currentUserId}
              />
            </div>
          )
        ) : (
          <>
            <div className="w-80 shrink-0">
              <ConversationsColumn
                conversations={filteredConversations}
                allConversations={allConversations}
                selectedId={selectedId}
                onSelect={handleSelectConversation}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onImport={handleImport}
                isImporting={isImporting}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                currentUserId={currentUserId}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <MessagesColumn
                conversationId={selectedId}
                conversations={allConversations}
                currentUserId={currentUserId}
              />
            </div>
            {/* Guest context — desktop only, collapsible */}
            {selectedId && selectedConv && (
              <div className="hidden w-72 shrink-0 border-l xl:block">
                <GuestContextPanel
                  guestId={selectedConv.guest_id}
                  contactPhone={selectedConv.contact_phone_e164}
                  contactName={selectedConv.contact_name}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Page
// -------------------------------------------------------

export default function ChatPage() {
  const { data: connection, isLoading } = useWhatsAppConnection();

  const isConnected = connection?.connected === true;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection || !isConnected) {
    return (
      <div className="flex h-full flex-col">
        <NoConnectionEmptyState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ConnectedChat connection={connection} />
    </div>
  );
}
