'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Check,
  CheckCheck,
  Wifi,
  WifiOff,
  Search,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWhatsAppConnection, useChatConversations, useChatMessages } from '@/hooks/use-chat';
import { useIsMobile } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

// -------------------------------------------------------
// Utilities
// -------------------------------------------------------

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ayer';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: es });
  return format(date, 'dd/MM/yy');
}

function formatConversationTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return formatMessageTime(dateStr);
}

function formatPhone(phone: string): string {
  // Show last 10 digits formatted
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const local = digits.slice(-10);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
}

// -------------------------------------------------------
// Status ticks
// -------------------------------------------------------

interface StatusTicksProps {
  status: string;
}

function StatusTicks({ status }: StatusTicksProps) {
  if (status === 'pending') {
    return <Check className="h-3 w-3 text-muted-foreground" />;
  }
  if (status === 'sent') {
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  }
  if (status === 'read') {
    return <CheckCheck className="h-3 w-3 text-blue-400" />;
  }
  return null;
}

// -------------------------------------------------------
// Empty state — no connection
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
      <Button onClick={() => window.location.href = '/configuracion/whatsapp'}>
        Conectar WhatsApp
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// Conversation list item
// -------------------------------------------------------

interface Conversation {
  id: string;
  contact_phone_e164: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
}

interface ConversationItemProps {
  conv: Conversation;
  selected: boolean;
  onClick: () => void;
}

function ConversationItem({ conv, selected, onClick }: ConversationItemProps) {
  const displayName = conv.contact_name || formatPhone(conv.contact_phone_e164);
  const timeLabel = formatConversationTime(conv.last_message_at);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        selected && 'bg-primary/10 hover:bg-primary/10',
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {displayName.charAt(0).toUpperCase()}
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
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
}

function ConversationsColumn({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: ConversationsColumnProps) {
  const filtered = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.contact_name ?? '').toLowerCase().includes(q) ||
      c.contact_phone_e164.includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col border-r">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-heading text-base font-semibold">Conversaciones</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {conversations.length}
          </span>
        </div>
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
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p>{searchQuery ? 'Sin resultados' : 'Sin conversaciones'}</p>
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
// Message bubble
// -------------------------------------------------------

interface Message {
  id: string;
  direction: 'in' | 'out';
  type: string;
  body: string | null;
  status: string;
  sent_from: string | null;
  created_at: string;
  external_id: string | null;
}

interface MessageBubbleProps {
  msg: Message;
}

function MessageBubble({ msg }: MessageBubbleProps) {
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
        <p className="whitespace-pre-wrap break-words">{msg.body ?? '(sin contenido)'}</p>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px]',
            isOut ? 'justify-end text-primary-foreground/70' : 'justify-end text-muted-foreground',
          )}
        >
          {msg.sent_from === 'phone' && (
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
// Messages column
// -------------------------------------------------------

interface MessagesColumnProps {
  conversationId: string | null;
  conversations: Conversation[];
  onBack?: () => void;
  showBackButton?: boolean;
}

function MessagesColumn({
  conversationId,
  conversations,
  onBack,
  showBackButton,
}: MessagesColumnProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useChatMessages(conversationId);

  const selectedConversation = conversations.find((c) => c.id === conversationId);
  const displayName = selectedConversation
    ? selectedConversation.contact_name ||
      formatPhone(selectedConversation.contact_phone_e164)
    : null;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!conversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <MessageCircle className="h-10 w-10 opacity-30" />
        <p className="text-sm">Selecciona una conversación</p>
      </div>
    );
  }

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
          {displayName?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName ?? 'Contacto'}</p>
          {selectedConversation && (
            <p className="text-xs text-muted-foreground">
              {selectedConversation.contact_phone_e164}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 px-4 py-4">
          {messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin mensajes aún
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje…"
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-xl border bg-muted/40 px-3 py-2 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40',
              'min-h-[44px] max-h-32 overflow-y-auto',
            )}
            style={{ fontSize: '16px' }} // iOS zoom prevention
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            aria-label="Enviar"
            className="h-10 w-10 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Presiona Enter para enviar · Shift + Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Connected chat view
// -------------------------------------------------------

interface ConnectedChatProps {
  connection: { status: string; display_name: string | null; phone_e164: string | null };
}

function ConnectedChat({ connection }: ConnectedChatProps) {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobileMessageView, setIsMobileMessageView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: conversations = [] } = useChatConversations();

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (isMobile) setIsMobileMessageView(true);
    },
    [isMobile],
  );

  const handleBack = useCallback(() => {
    setIsMobileMessageView(false);
  }, []);

  const isConnected = connection.status === 'connected';

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
        {isConnected ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span>
          {isConnected
            ? `Conectado${connection.display_name ? ` · ${connection.display_name}` : ''}${connection.phone_e164 ? ` · ${connection.phone_e164}` : ''}`
            : 'Sin conexión — reconectando…'}
        </span>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {isMobile ? (
          /* Mobile: either list or messages */
          isMobileMessageView ? (
            <div className="flex h-full w-full flex-col">
              <MessagesColumn
                conversationId={selectedId}
                conversations={conversations}
                onBack={handleBack}
                showBackButton
              />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col">
              <ConversationsColumn
                conversations={conversations}
                selectedId={selectedId}
                onSelect={handleSelectConversation}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
          )
        ) : (
          /* Desktop: side by side */
          <>
            <div className="w-80 shrink-0">
              <ConversationsColumn
                conversations={conversations}
                selectedId={selectedId}
                onSelect={handleSelectConversation}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <MessagesColumn
                conversationId={selectedId}
                conversations={conversations}
              />
            </div>
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

  const isConnected = connection?.status === 'connected';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
