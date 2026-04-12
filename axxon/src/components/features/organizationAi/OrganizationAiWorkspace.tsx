// Renders the persisted org-scoped AI chat workspace with a creator-owned thread sidebar.
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  Square,
  User2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button, { buttonClassName } from '@/components/ui/Button';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import PageHero from '@/components/ui/PageHero';
import Surface from '@/components/ui/Surface';
import { fetchOrganizationAiThread } from '@/lib/api/organizations/getOrganizationAiThread';
import { fetchOrganizationAiThreads } from '@/lib/api/organizations/getOrganizationAiThreads';
import { fetchOrganization } from '@/lib/api/organizations/getOrganization';
import { streamOrganizationAiChat } from '@/lib/api/organizations/streamOrganizationAiChat';
import type { AiRuntimeSummary, AiStreamEvent } from '@/lib/types/aiTypes';
import type {
  OrganizationAiChatMessage,
  OrganizationAiChatThread,
} from '@/lib/types/organizationAiChatTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

type ChatMessage = Pick<
  OrganizationAiChatMessage,
  'role' | 'content' | 'status' | 'model'
> & {
  id: string;
  pending?: boolean;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function mapPersistedMessage(message: OrganizationAiChatMessage): ChatMessage {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    status: message.status,
    model: message.model,
  };
}

function parseSelectedThreadId(searchParams: Pick<URLSearchParams, 'get'>) {
  const rawValue = searchParams.get('threadId');
  const parsedValue = rawValue ? Number(rawValue) : null;

  return parsedValue && Number.isFinite(parsedValue) ? parsedValue : null;
}

// Consume the backend NDJSON stream a line at a time so assistant output can render incrementally.
function parseAiStreamBuffer({
  buffer,
  flush = false,
  onEvent,
}: {
  buffer: string;
  flush?: boolean;
  onEvent: (event: AiStreamEvent) => void;
}) {
  const lines = buffer.split('\n');
  const pendingLine = flush ? lines.pop() ?? '' : '';
  const pendingBuffer = flush ? '' : lines.pop() ?? '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    onEvent(JSON.parse(line) as AiStreamEvent);
  }

  if (flush && pendingLine.trim()) {
    onEvent(JSON.parse(pendingLine.trim()) as AiStreamEvent);
  }

  return pendingBuffer;
}

// Normalize API failures into a single string for the chat error banner.
async function readAiError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Failed to process the AI chat request';
  } catch {
    return 'Failed to process the AI chat request';
  }
}

export default function OrganizationAiWorkspace({
  organizationId,
  runtime,
}: {
  organizationId: string;
  runtime: AiRuntimeSummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const selectedThreadId = useMemo(
    () => parseSelectedThreadId(searchParams),
    [searchParams]
  );

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => fetchOrganization(organizationId),
  });
  const {
    data: threads = [],
    error: threadsError,
    isLoading: isThreadsLoading,
  } = useQuery<OrganizationAiChatThread[]>({
    queryKey: ['organization-ai-threads', organizationId],
    queryFn: () => fetchOrganizationAiThreads(organizationId),
  });
  const {
    data: selectedThreadData,
    error: selectedThreadError,
    isLoading: isSelectedThreadLoading,
  } = useQuery({
    queryKey: ['organization-ai-thread', organizationId, selectedThreadId],
    queryFn: () => fetchOrganizationAiThread(organizationId, selectedThreadId!),
    enabled: typeof selectedThreadId === 'number',
  });

  const selectedThread =
    selectedThreadData?.thread ??
    threads.find((thread) => thread.id === selectedThreadId) ??
    null;

  useEffect(() => {
    if (isStreaming) {
      return;
    }

    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    if (selectedThreadData) {
      setMessages(selectedThreadData.messages.map(mapPersistedMessage));
    }
  }, [isStreaming, selectedThreadData, selectedThreadId]);

  useEffect(() => {
    if (isStreaming || !selectedThreadId || !selectedThreadError) {
      return;
    }

    setMessages([]);
  }, [isStreaming, selectedThreadError, selectedThreadId]);

  useEffect(() => {
    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const setSelectedThreadInUrl = (threadId: number | null, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());

    if (typeof threadId === 'number') {
      params.set('threadId', String(threadId));
    } else {
      params.delete('threadId');
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

    if (replace) {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  };

  if (isOrganizationLoading || !organization) {
    return (
      <div className="app-page">
        <Surface variant="strong" className="rounded-[2rem] p-8">
          <p className="app-kicker">Organization AI</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading AI workspace...</h1>
        </Surface>
      </div>
    );
  }

  const accentColor = resolveAccentColor(organization.color);
  const canSend =
    runtime.available &&
    draft.trim().length > 0 &&
    !isStreaming &&
    !isSelectedThreadLoading;
  const sidebarErrorMessage =
    threadsError instanceof Error ? threadsError.message : '';
  const threadLoadErrorMessage =
    selectedThreadId && selectedThreadError instanceof Error
      ? selectedThreadError.message
      : '';

  const updateAssistantMessage = (
    assistantMessageId: string,
    updater: (message: ChatMessage) => ChatMessage | null
  ) => {
    setMessages((currentMessages) =>
      currentMessages.flatMap((message) => {
        if (message.id !== assistantMessageId) {
          return [message];
        }

        const nextMessage = updater(message);
        return nextMessage ? [nextMessage] : [];
      })
    );
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const startNewChat = () => {
    abortControllerRef.current?.abort();
    setDraft('');
    setErrorMessage('');
    setMessages([]);
    setSelectedThreadInUrl(null);
  };

  const invalidateChatQueries = (threadId: number | null) => {
    void queryClient.invalidateQueries({
      queryKey: ['organization-ai-threads', organizationId],
    });

    if (typeof threadId === 'number') {
      void queryClient.invalidateQueries({
        queryKey: ['organization-ai-thread', organizationId, threadId],
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const trimmedDraft = draft.trim();
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedDraft,
      status: 'completed',
      model: null,
    };
    const assistantMessageId = createMessageId();
    let activeThreadId = selectedThreadId;
    let streamFailed = false;
    let wasAborted = false;

    setDraft('');
    setErrorMessage('');
    setIsStreaming(true);
    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        status: 'completed',
        model: runtime.model,
        pending: true,
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await streamOrganizationAiChat({
        organizationId,
        threadId: selectedThreadId ?? undefined,
        content: trimmedDraft,
        signal: abortController.signal,
      });
      const responseThreadId = Number(
        response.headers.get('x-axxon-ai-thread-id') ?? ''
      );

      if (Number.isFinite(responseThreadId) && responseThreadId > 0) {
        activeThreadId = responseThreadId;

        if (selectedThreadId !== responseThreadId) {
          setSelectedThreadInUrl(responseThreadId, true);
        }
      }

      invalidateChatQueries(activeThreadId);

      if (!response.ok || !response.body) {
        throw new Error(await readAiError(response));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          buffer = parseAiStreamBuffer({
            buffer,
            onEvent: (streamEvent) => {
              if (streamEvent.type === 'delta') {
                updateAssistantMessage(assistantMessageId, (message) => ({
                  ...message,
                  content: `${message.content}${streamEvent.delta}`,
                }));
              }

              if (streamEvent.type === 'error') {
                streamFailed = true;
                setErrorMessage(streamEvent.error);
              }
            },
          });
        }

        buffer += decoder.decode();
        parseAiStreamBuffer({
          buffer,
          flush: true,
          onEvent: (streamEvent) => {
            if (streamEvent.type === 'delta') {
              updateAssistantMessage(assistantMessageId, (message) => ({
                ...message,
                content: `${message.content}${streamEvent.delta}`,
              }));
            }

            if (streamEvent.type === 'error') {
              streamFailed = true;
              setErrorMessage(streamEvent.error);
            }
          },
        });
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (isAbortError(error)) {
        wasAborted = true;
      } else {
        streamFailed = true;
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to get the AI response'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      updateAssistantMessage(assistantMessageId, (message) => ({
        ...message,
        content:
          message.content.trim() ||
          (streamFailed || wasAborted
            ? 'Generation stopped before completion.'
            : 'No response generated.'),
        pending: false,
        status: streamFailed || wasAborted ? 'failed' : 'completed',
      }));
      invalidateChatQueries(activeThreadId);
    }
  };

  // Match chat apps: Enter submits, Shift+Enter preserves multiline drafting.
  const handleComposerKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div className="app-page">
      <PageHero
        kicker="Organization AI"
        title={`${organization.name} AI workspace`}
        description="Persist and reopen org-level AI conversations with a ChatGPT-style thread list backed by the active Axxon AI runtime."
        accentColor={accentColor}
        actions={
          <>
            <Link
              href={buildOrganizationPath(organizationId)}
              className={buttonClassName({})}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Organization
            </Link>
            <Button variant="ghost" onClick={startNewChat}>
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </>
        }
        badges={
          <>
            <Badge>
              <Sparkles className="h-3.5 w-3.5" />
              {runtime.providerLabel}
            </Badge>
            <Badge>
              <Bot className="h-3.5 w-3.5" />
              {runtime.model}
            </Badge>
            <Badge>{runtime.stage}</Badge>
          </>
        }
      />

      <Surface variant="strong" className="overflow-hidden rounded-[2rem]">
        <div className="flex min-h-[680px] flex-col xl:flex-row">
          <aside className="xl:flex xl:w-[320px] xl:shrink-0 xl:flex-col xl:border-r xl:border-[var(--app-border)]">
            <div className="border-b border-[var(--app-border)] px-5 py-4 sm:px-6 xl:px-5">
              <p className="app-kicker">Chat Threads</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Your persisted chats
              </h2>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                Every new conversation gets a generated title and summary so you can
                reopen it later from this mini-sidebar.
              </p>
            </div>

            <div className="max-h-[280px] overflow-y-auto p-3 sm:p-4 xl:max-h-none xl:min-h-0 xl:flex-1">
              {sidebarErrorMessage ? (
                <Surface variant="default" className="rounded-[1.4rem] p-4 text-sm text-rose-300">
                  {sidebarErrorMessage}
                </Surface>
              ) : null}

              <button
                type="button"
                onClick={startNewChat}
                disabled={isStreaming}
                className={`mb-3 flex w-full items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition ${
                  !selectedThreadId
                    ? 'border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                    : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)] hover:border-[var(--app-border-strong)]'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--app-accent)_16%,transparent)] text-[var(--app-accent-foreground)]">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    New conversation
                  </span>
                  <span className="block truncate text-xs app-text-muted">
                    Start a fresh org-level AI thread
                  </span>
                </span>
              </button>

              {isThreadsLoading ? (
                <Surface variant="default" className="rounded-[1.4rem] p-4">
                  <p className="text-sm app-text-muted">Loading chat threads...</p>
                </Surface>
              ) : null}

              {!isThreadsLoading && threads.length === 0 ? (
                <Surface variant="default" className="rounded-[1.4rem] p-4">
                  <p className="text-sm app-text-muted">
                    Your first message will create a saved thread here.
                  </p>
                </Surface>
              ) : null}

              <div className="space-y-3">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadInUrl(thread.id)}
                    disabled={isStreaming}
                    className={`w-full rounded-[1.25rem] border px-4 py-3 text-left transition ${
                      selectedThreadId === thread.id
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                        : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)] hover:border-[var(--app-border-strong)]'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <p className="truncate text-sm font-semibold">{thread.title}</p>
                    <p className="mt-1 text-xs leading-5 app-text-muted">
                      {thread.summary}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 sm:px-6">
              <div>
                <p className="app-kicker">{selectedThread ? 'Saved Chat' : 'Beta Chat'}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {selectedThread?.title ?? 'New conversation'}
                </h2>
                <p className="mt-2 text-sm leading-6 app-text-muted">
                  {selectedThread?.summary ??
                    (runtime.available
                      ? 'Messages stream through the org-scoped AI route and persist to reopen later from the sidebar.'
                      : 'This environment is reserved for the future cloud provider. Chat is disabled until that adapter is configured.')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {isStreaming ? (
                  <Button variant="ghost" onClick={stopGeneration}>
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                ) : null}
              </div>
            </div>

            <div
              ref={transcriptRef}
              className="max-h-[58vh] min-h-[380px] space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
            >
              {isSelectedThreadLoading && selectedThreadId ? (
                <Surface variant="default" className="rounded-[1.6rem] p-6">
                  <p className="app-kicker">Loading Thread</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">
                    Rehydrating saved conversation...
                  </h3>
                </Surface>
              ) : null}

              {threadLoadErrorMessage ? (
                <Surface variant="default" className="rounded-[1.6rem] p-6 text-sm text-rose-300">
                  {threadLoadErrorMessage}
                </Surface>
              ) : null}

              {!isSelectedThreadLoading && messages.length === 0 ? (
                <Surface variant="default" className="rounded-[1.6rem] p-6">
                  <p className="app-kicker">Empty State</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">
                    Start the next org-level AI conversation
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 app-text-muted">
                    Ask for planning help, sprint summaries, or the next product step.
                    The first prompt creates a saved thread with an AI-generated title
                    and summary in the sidebar.
                  </p>
                </Surface>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex max-w-3xl items-start gap-3 rounded-[1.5rem] border px-4 py-3 sm:px-5 ${
                      message.role === 'user'
                        ? 'border-[color-mix(in_srgb,var(--app-accent)_28%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-accent)_14%,var(--app-panel-strong))]'
                        : message.status === 'failed'
                          ? 'border-[color-mix(in_srgb,#f43f5e_32%,var(--app-border))] bg-[color-mix(in_srgb,#f43f5e_10%,var(--app-panel-soft))]'
                          : 'border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_78%,transparent)]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] text-[var(--app-accent-foreground)]'
                          : 'bg-[color-mix(in_srgb,var(--app-highlight)_14%,transparent)] text-[var(--app-highlight)]'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User2 className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {message.role === 'user' ? 'You' : 'Axxon AI'}
                        </p>
                        {message.pending ? (
                          <LoaderCircle className="h-4 w-4 animate-spin app-text-muted" />
                        ) : null}
                        {message.role === 'assistant' && message.status === 'failed' ? (
                          <span className="text-xs font-medium text-rose-300">
                            Failed response
                          </span>
                        ) : null}
                      </div>
                      {message.role === 'user' ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                          {message.content}
                        </p>
                      ) : (
                        <MarkdownRenderer
                          content={message.content || 'Thinking...'}
                          className="mt-2 break-words"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {errorMessage ? (
              <div className="border-t border-[var(--app-border)] px-5 py-3 text-sm text-rose-300 sm:px-6">
                {errorMessage}
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit}
              className="border-t border-[var(--app-border)] px-4 py-4 sm:px-6"
            >
              <label className="block">
                <span className="sr-only">AI chat message</span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    runtime.available
                      ? 'Ask Axxon AI about planning, execution, or the next MVP step...'
                      : 'Cloud AI is not configured in this environment yet.'
                  }
                  disabled={!runtime.available || isStreaming}
                  rows={5}
                  className="w-full resize-none rounded-[1.6rem] border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-panel-soft)_80%,transparent)] px-4 py-3 text-sm leading-7 text-[var(--app-foreground)] outline-none focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--app-accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm app-text-muted">
                  Press Enter to send. Use Shift+Enter for a newline.
                </p>

                <Button variant="primary" type="submit" disabled={!canSend}>
                  {isStreaming ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Message
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Surface>
    </div>
  );
}
