'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Send,
  ArrowLeft,
  Search,
  Plus,
  X,
  Paperclip,
  Eye,
  CheckCircle2,
  XCircle,
  User,
  MailOpen,
  Inbox,
  Archive,
  Download,
  MoreHorizontal,
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-media-query';
import { useProfile } from '@/hooks/use-profile';
import {
  useEmailThreads,
  useEmailMessages,
  useEmailRealtime,
  useReplyToThread,
  useComposeEmail,
  useMarkEmailThreadRead,
  useAssignEmailThread,
  useSetEmailThreadStatus,
  useLinkGuestToThread,
  type EmailThread,
  type EmailMessage,
} from '@/hooks/use-email-inbox';
import { cn } from '@/lib/utils';
import { ComposeEmailDialog } from '@/components/email/compose-email-dialog';
import { EmailGuestPanel } from '@/components/email/email-guest-panel';
import { extractPreviewText, splitPlainTextQuote, htmlHasQuotedContent, QUOTE_HIDE_CSS } from '@/lib/email/quote-utils';
import type { StoredAttachment } from '@/lib/email/types';

// -------------------------------------------------------
// Utilities
// -------------------------------------------------------

function formatThreadTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'ayer';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: es });
  return format(date, 'dd/MM/yy');
}

function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

function formatMessageTime(dateStr: string): string {
  return format(new Date(dateStr), 'HH:mm');
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// -------------------------------------------------------
// Filter types
// -------------------------------------------------------

type FilterKey = 'inbox' | 'unread' | 'mine' | 'others' | 'closed';

interface FilterChip {
  key: FilterKey;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'inbox', label: 'Recibidos' },
  { key: 'unread', label: 'Sin responder' },
  { key: 'mine', label: 'Míos' },
  { key: 'others', label: 'Otros' },
  { key: 'closed', label: 'Cerrados' },
];

// -------------------------------------------------------
// Main Page
// -------------------------------------------------------

export default function CorreoPage() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  useEmailRealtime();

  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('thread'));
  const [isMobileMessageView, setIsMobileMessageView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const { data: profile } = useProfile();
  const currentUserId = profile?.id ?? null;

  const markRead = useMarkEmailThreadRead();
  const { data: allThreads = [], isLoading: threadsLoading } = useEmailThreads();

  // Filter threads
  const filteredThreads = useMemo(() => {
    let filtered: EmailThread[];
    switch (activeFilter) {
      case 'unread':
        filtered = allThreads.filter((t) => t.status === 'open' && t.unread_count > 0);
        break;
      case 'mine':
        filtered = allThreads.filter((t) => t.assigned_to === currentUserId && t.status === 'open');
        break;
      case 'others':
        filtered = allThreads.filter((t) => !t.guest_id && t.status === 'open');
        break;
      case 'closed':
        filtered = allThreads.filter((t) => t.status === 'closed');
        break;
      default: // inbox
        filtered = allThreads.filter((t) => t.status === 'open');
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          (t.sender_address ?? '').toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [allThreads, activeFilter, currentUserId, searchQuery]);

  const selectedThread = allThreads.find((t) => t.id === selectedId) ?? null;

  const handleSelectThread = useCallback(
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

  function countFilter(key: FilterKey): number {
    switch (key) {
      case 'inbox': return allThreads.filter((t) => t.status === 'open').length;
      case 'unread': return allThreads.filter((t) => t.status === 'open' && t.unread_count > 0).length;
      case 'mine': return allThreads.filter((t) => t.assigned_to === currentUserId && t.status === 'open').length;
      case 'others': return allThreads.filter((t) => !t.guest_id && t.status === 'open').length;
      case 'closed': return allThreads.filter((t) => t.status === 'closed').length;
    }
  }

  return (
    <div className="-mx-4 -my-6 flex flex-col overflow-hidden sm:-mx-6 md:-mx-8" style={{ height: 'calc(100dvh - 64px)' }}>
      <div className="flex min-h-0 flex-1">
        {isMobile ? (
          isMobileMessageView ? (
            <div className="flex h-full w-full flex-col">
              <ThreadDetail
                thread={selectedThread}
                onBack={handleBack}
                isMobile
              />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col">
              <ThreadsColumn
                threads={filteredThreads}
                selectedId={selectedId}
                searchQuery={searchQuery}
                activeFilter={activeFilter}
                isLoading={threadsLoading}
                onSelect={handleSelectThread}
                onSearchChange={setSearchQuery}
                onFilterChange={setActiveFilter}
                onCompose={() => setComposeOpen(true)}
                countFilter={countFilter}
              />
            </div>
          )
        ) : (
          <>
            {/* Left: thread list */}
            <div className="flex w-80 shrink-0 flex-col border-r">
              <ThreadsColumn
                threads={filteredThreads}
                selectedId={selectedId}
                searchQuery={searchQuery}
                activeFilter={activeFilter}
                isLoading={threadsLoading}
                onSelect={handleSelectThread}
                onSearchChange={setSearchQuery}
                onFilterChange={setActiveFilter}
                onCompose={() => setComposeOpen(true)}
                countFilter={countFilter}
              />
            </div>

            {/* Center: thread detail */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selectedThread ? (
                <ThreadDetail thread={selectedThread} />
              ) : (
                <EmptyState />
              )}
            </div>

            {/* Right: guest panel (xl only) */}
            {selectedThread && (
              <div className="hidden w-72 shrink-0 border-l xl:block">
                <EmailGuestPanel
                  guestId={selectedThread.guest_id}
                  threadId={selectedThread.id}
                  senderAddress={selectedThread.sender_address}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
      />
    </div>
  );
}

// -------------------------------------------------------
// Threads Column (left sidebar)
// -------------------------------------------------------

interface ThreadsColumnProps {
  threads: EmailThread[];
  selectedId: string | null;
  searchQuery: string;
  activeFilter: FilterKey;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onSearchChange: (q: string) => void;
  onFilterChange: (f: FilterKey) => void;
  onCompose: () => void;
  countFilter: (key: FilterKey) => number;
}

function ThreadsColumn({
  threads,
  selectedId,
  searchQuery,
  activeFilter,
  isLoading,
  onSelect,
  onSearchChange,
  onFilterChange,
  onCompose,
  countFilter,
}: ThreadsColumnProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="font-heading text-lg font-semibold">Correo</h1>
        </div>
        <Button size="sm" variant="outline" onClick={onCompose} className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Redactar</span>
        </Button>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar correo..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b px-3 py-2">
        {FILTER_CHIPS.map((chip) => {
          const count = countFilter(chip.key);
          return (
            <button
              key={chip.key}
              onClick={() => onFilterChange(chip.key)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                activeFilter === chip.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {chip.label}
              {count > 0 && <span className="rounded-full px-1 text-[10px]">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            <p>No hay correos</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5">
            {threads.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                isSelected={thread.id === selectedId}
                onSelect={() => onSelect(thread.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Thread List Item
// -------------------------------------------------------

function ThreadListItem({
  thread,
  isSelected,
  onSelect,
}: {
  thread: EmailThread;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-accent'
          : 'hover:bg-muted/50',
      )}
    >
      {/* Avatar / icon */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white',
        thread.guest_id ? 'bg-blue-500' : 'bg-gray-400',
      )}>
        {thread.guest_id ? (
          <User className="h-4 w-4" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'truncate text-sm',
            thread.unread_count > 0 ? 'font-semibold' : 'font-medium',
          )}>
            {thread.sender_address || '(sin remitente)'}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatThreadTime(thread.last_message_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'truncate text-xs',
            thread.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}>
            {thread.subject}
          </span>
          {thread.unread_count > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {thread.unread_count}
            </span>
          )}
        </div>
        {thread.last_message_preview && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {thread.last_message_preview}
          </p>
        )}
      </div>
    </button>
  );
}

// -------------------------------------------------------
// Thread Detail (center column)
// -------------------------------------------------------

interface ThreadDetailProps {
  thread: EmailThread | null;
  onBack?: () => void;
  isMobile?: boolean;
}

function ThreadDetail({ thread, onBack, isMobile }: ThreadDetailProps) {
  const { data: messages = [], isLoading } = useEmailMessages(thread?.id ?? null);
  const reply = useReplyToThread();
  const setStatus = useSetEmailThreadStatus();
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!thread) {
    return <EmptyState />;
  }

  const handleSendReply = () => {
    const text = replyText.trim();
    if (!text) return;
    reply.mutate({ threadId: thread.id, body: text });
    setReplyText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        {(isMobile || onBack) && (
          <button type="button" onClick={onBack} className="rounded-md p-1 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{thread.subject}</h2>
          <p className="truncate text-xs text-muted-foreground">{thread.sender_address}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {thread.status === 'open' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus.mutate({ threadId: thread.id, status: 'closed' })}
              className="h-7 gap-1 text-xs"
            >
              <Archive className="h-3.5 w-3.5" />
              Cerrar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus.mutate({ threadId: thread.id, status: 'open' })}
              className="h-7 gap-1 text-xs"
            >
              <MailOpen className="h-3.5 w-3.5" />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Mail className="h-8 w-8 opacity-40" />
            <p>No hay mensajes en este hilo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => {
              const showDate = idx === 0 || !isSameDay(messages[idx - 1].created_at, msg.created_at);
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatMessageDate(msg.created_at)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <EmailMessageCard message={msg} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply compose */}
      {thread.status === 'open' && (
        <div className="shrink-0 border-t bg-background p-3">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta..."
              className="min-h-[60px] max-h-[160px] resize-none text-sm"
              rows={2}
            />
            <Button
              size="sm"
              onClick={handleSendReply}
              disabled={!replyText.trim() || reply.isPending}
              className="h-auto self-end px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Email Message Card
// -------------------------------------------------------

function EmailMessageCard({ message }: { message: EmailMessage }) {
  const [showImages, setShowImages] = useState(false);
  const [showQuoted, setShowQuoted] = useState(false);
  const isInbound = message.direction === 'in';
  const hasBlockedImages = message.html_sanitized?.includes('data-original-src=') ?? false;
  const attachments: StoredAttachment[] = Array.isArray(message.attachments) ? message.attachments : [];

  // Detect quoted content
  const hasQuoted = useMemo(() => {
    if (message.html_sanitized) return htmlHasQuotedContent(message.html_sanitized);
    if (message.body_text) return splitPlainTextQuote(message.body_text).quotedText !== null;
    return false;
  }, [message.html_sanitized, message.body_text]);

  // Build HTML for iframe, optionally restoring blocked images
  const displayHtml = useMemo(() => {
    if (!message.html_sanitized) return null;
    let html = message.html_sanitized;
    if (showImages) {
      html = html.replace(
        /src="data:image\/png;base64,[^"]*"\s*alt="([^"]*)"\s*data-original-src="([^"]*)"/g,
        'src="$2" alt="$1"',
      );
    }
    return html;
  }, [message.html_sanitized, showImages]);

  return (
    <div className={cn(
      'rounded-lg border bg-card p-4',
      isInbound ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-green-400',
    )}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-medium',
              isInbound ? 'text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400',
            )}>
              {isInbound ? (message.from_address || 'Remitente desconocido') : 'Tú'}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {isInbound ? 'Recibido' : 'Enviado'}
            </Badge>
          </div>
          {!isInbound && (
            <p className="text-xs text-muted-foreground">Para: {message.to}</p>
          )}
          {message.cc && message.cc.length > 0 && (
            <p className="text-xs text-muted-foreground">CC: {message.cc.join(', ')}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatMessageTime(message.created_at)}
        </span>
      </div>

      {/* Blocked images notice */}
      {hasBlockedImages && !showImages && (
        <button
          type="button"
          onClick={() => setShowImages(true)}
          className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
        >
          <Eye className="h-3.5 w-3.5" />
          Mostrar imágenes externas
        </button>
      )}

      {/* Body */}
      {displayHtml ? (<>
        <iframe
          srcDoc={wrapHtmlForIframe(displayHtml, !showQuoted)}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="w-full rounded border-0 bg-white"
          style={{ minHeight: 80, maxHeight: 500 }}
          onLoad={(e) => {
            const iframe = e.currentTarget;
            try {
              const body = iframe.contentDocument?.body;
              if (body) {
                iframe.style.height = `${Math.min(body.scrollHeight + 16, 500)}px`;
              }
            } catch {
              // Cross-origin — ignore
            }
          }}
        />
        {hasQuoted && !showQuoted && (
          <button
            type="button"
            onClick={() => setShowQuoted(true)}
            className="mt-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
          >
            <MoreHorizontal className="h-3 w-3" />
            Mostrar texto citado
          </button>
        )}
      </>
      ) : message.body_text ? (
        (() => {
          const { newText, quotedText } = splitPlainTextQuote(message.body_text);
          return (
            <div className="text-sm text-foreground">
              <div className="whitespace-pre-wrap">{showQuoted ? message.body_text : newText}</div>
              {quotedText && !showQuoted && (
                <button
                  type="button"
                  onClick={() => setShowQuoted(true)}
                  className="mt-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                >
                  <MoreHorizontal className="h-3 w-3" />
                  Mostrar texto citado
                </button>
              )}
            </div>
          );
        })()

      ) : (
        <p className="text-sm text-muted-foreground italic">(sin contenido)</p>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {attachments.length} adjunto{attachments.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      {message.status === 'failed' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          Error al enviar{message.error ? `: ${message.error}` : ''}
        </div>
      )}
      {message.status === 'delivered' && message.direction === 'out' && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Entregado
        </div>
      )}
    </div>
  );
}

function wrapHtmlForIframe(html: string, hideQuotes: boolean = false): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; margin: 8px; word-wrap: break-word; overflow-wrap: break-word; }
    img { max-width: 100%; height: auto; }
    a { color: #2563eb; }
    table { max-width: 100%; }
    ${hideQuotes ? QUOTE_HIDE_CSS : ''}
  </style>
</head>
<body${hideQuotes ? '' : ' class="posty-show-quoted"'}>${html}</body>
</html>`;
}

// -------------------------------------------------------
// Attachment Chip
// -------------------------------------------------------

function AttachmentChip({ attachment }: { attachment: StoredAttachment }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email/attachments?path=${encodeURIComponent(attachment.storage_path)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const sizeLabel = attachment.size < 1024
    ? `${attachment.size} B`
    : attachment.size < 1024 * 1024
      ? `${(attachment.size / 1024).toFixed(0)} KB`
      : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
    >
      <Download className="h-3 w-3 text-muted-foreground" />
      <span className="max-w-[140px] truncate">{attachment.filename}</span>
      <span className="text-muted-foreground">({sizeLabel})</span>
    </button>
  );
}

// -------------------------------------------------------
// Empty State
// -------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Mail className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-heading text-sm font-semibold">Selecciona un correo</h3>
        <p className="text-xs text-muted-foreground">Elige un hilo de la lista para ver sus mensajes</p>
      </div>
    </div>
  );
}
