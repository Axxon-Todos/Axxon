// Renders the existing org AI assistant chat with persisted threads and incremental streaming responses.
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  Bot,
  LoaderCircle,
  Plus,
  Send,
  Square,
  User2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import Surface from '@/components/ui/Surface';
import { fetchOrganizationAiThread } from '@/lib/api/organizations/getOrganizationAiThread';
import { fetchOrganizationAiThreads } from '@/lib/api/organizations/getOrganizationAiThreads';
import { streamOrganizationAiChat } from '@/lib/api/organizations/streamOrganizationAiChat';
import type { AiRuntimeSummary, AiStreamEvent } from '@/lib/types/aiTypes';
import type {
  OrganizationAiChatMessage,
  OrganizationAiChatThread,
} from '@/lib/types/organizationAiChatTypes';

type ChatMessage = Pick<
  OrganizationAiChatMessage,
  'role' | 'content' | 'status' | 'model'
> & {
  id: string;
  pending?: boolean;
};

const TRANSCRIPT_FOLLOW_THRESHOLD_PX = 48;
const STREAM_REVEAL_MIN_INTERVAL_MS = 24;
const STREAM_REVEAL_BASE_CHUNK_SIZE = 18;
const STREAM_REVEAL_MEDIUM_CHUNK_SIZE = 36;
const STREAM_REVEAL_LARGE_CHUNK_SIZE = 60;
const STREAM_REVEAL_FINISH_CHUNK_SIZE = 120;
const STREAM_REVEAL_BOUNDARY_LOOKAHEAD = 12;

type RevealMode = 'normal' | 'finishing';

type PendingAssistantCompletion = {
  streamFailed: boolean;
  threadId: number | null;
  wasAborted: boolean;
};

type RevealLoopHandle = number | ReturnType<typeof globalThis.setTimeout>;

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

function isTranscriptNearBottom(
  element: HTMLDivElement,
  threshold = TRANSCRIPT_FOLLOW_THRESHOLD_PX
) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function getRevealChunkSize({
  pendingLength,
  revealMode,
}: {
  pendingLength: number;
  revealMode: RevealMode;
}) {
  if (revealMode === 'finishing') {
    return Math.max(STREAM_REVEAL_FINISH_CHUNK_SIZE, Math.ceil(pendingLength / 2));
  }

  if (pendingLength > 320) {
    return STREAM_REVEAL_LARGE_CHUNK_SIZE;
  }

  if (pendingLength > 120) {
    return STREAM_REVEAL_MEDIUM_CHUNK_SIZE;
  }

  return STREAM_REVEAL_BASE_CHUNK_SIZE;
}

function takeNextRevealChunk({
  pendingContent,
  revealMode,
}: {
  pendingContent: string;
  revealMode: RevealMode;
}) {
  const chunkSize = getRevealChunkSize({
    pendingLength: pendingContent.length,
    revealMode,
  });

  if (pendingContent.length <= chunkSize) {
    return pendingContent;
  }

  const minBoundaryIndex = Math.max(1, chunkSize - 6);
  const maxBoundaryIndex = Math.min(
    pendingContent.length,
    chunkSize + STREAM_REVEAL_BOUNDARY_LOOKAHEAD
  );

  for (let index = maxBoundaryIndex; index >= minBoundaryIndex; index -= 1) {
    if (/[\s,.;!?]/.test(pendingContent[index - 1] ?? '')) {
      return pendingContent.slice(0, index);
    }
  }

  return pendingContent.slice(0, chunkSize);
}

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

async function readAiError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? 'Failed to process the AI chat request';
  } catch {
    return 'Failed to process the AI chat request';
  }
}

export default function OrganizationAiAssistantPanel({
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
  const [isProviderStreaming, setIsProviderStreaming] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const isProviderStreamingRef = useRef(false);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const pendingRevealContentRef = useRef('');
  const renderedAssistantContentRef = useRef('');
  const revealFrameRef = useRef<RevealLoopHandle | null>(null);
  const revealFrameStrategyRef = useRef<'animation-frame' | 'timeout' | null>(null);
  const revealLastTimestampRef = useRef<number | null>(null);
  const revealModeRef = useRef<RevealMode>('normal');
  const pendingCompletionRef = useRef<PendingAssistantCompletion | null>(null);
  const selectedThreadId = useMemo(
    () => parseSelectedThreadId(searchParams),
    [searchParams]
  );

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
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (!mediaQueryList) {
      return;
    }

    const handleMotionPreferenceChange = () => {
      setPrefersReducedMotion(mediaQueryList.matches);
    };

    handleMotionPreferenceChange();

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleMotionPreferenceChange);

      return () => {
        mediaQueryList.removeEventListener('change', handleMotionPreferenceChange);
      };
    }

    mediaQueryList.addListener(handleMotionPreferenceChange);

    return () => {
      mediaQueryList.removeListener(handleMotionPreferenceChange);
    };
  }, []);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
  }, [selectedThreadId]);

  useEffect(() => {
    if (isStreaming) {
      return;
    }

    setShowJumpToLatest(false);
  }, [isStreaming]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cancelRevealLoop();
    };
  }, []);

  function requestRevealFrame(callback: FrameRequestCallback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      revealFrameStrategyRef.current = 'animation-frame';
      return window.requestAnimationFrame(callback);
    }

    revealFrameStrategyRef.current = 'timeout';
    return globalThis.setTimeout(
      () => callback(Date.now()),
      STREAM_REVEAL_MIN_INTERVAL_MS
    );
  }

  function cancelRevealLoop() {
    if (revealFrameRef.current === null) {
      return;
    }

    if (
      revealFrameStrategyRef.current === 'animation-frame' &&
      typeof window !== 'undefined' &&
      typeof window.cancelAnimationFrame === 'function'
    ) {
      window.cancelAnimationFrame(revealFrameRef.current as number);
    } else {
      clearTimeout(revealFrameRef.current);
    }

    revealFrameRef.current = null;
    revealFrameStrategyRef.current = null;
  }

  function setTranscriptFollowState(shouldAutoScroll: boolean) {
    shouldAutoScrollRef.current = shouldAutoScroll;
    setShowJumpToLatest(isStreaming && !shouldAutoScroll);
  }

  function scrollTranscriptToBottom({ smooth = false }: { smooth?: boolean } = {}) {
    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    const behavior =
      smooth && !prefersReducedMotion ? ('smooth' as const) : ('auto' as const);

    if (typeof transcriptElement.scrollTo === 'function') {
      transcriptElement.scrollTo({
        top: transcriptElement.scrollHeight,
        behavior,
      });
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    if (typeof transcriptElement.scrollTo === 'function') {
      transcriptElement.scrollTo({
        top: transcriptElement.scrollHeight,
        behavior: 'auto',
      });
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [messages]);

  const setSelectedThreadInUrl = (threadId: number | null, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', 'assistant');

    if (typeof threadId === 'number') {
      params.set('threadId', String(threadId));
    } else {
      params.delete('threadId');
    }

    params.delete('boardId');
    params.delete('sessionId');

    const nextUrl = `${pathname}?${params.toString()}`;

    if (replace) {
      router.replace(nextUrl, { scroll: false });
      return;
    }

    router.push(nextUrl, { scroll: false });
  };

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

  function appendAssistantContent(contentChunk: string) {
    const assistantMessageId = activeAssistantMessageIdRef.current;

    if (!assistantMessageId || !contentChunk) {
      return;
    }

    renderedAssistantContentRef.current = `${renderedAssistantContentRef.current}${contentChunk}`;
    updateAssistantMessage(assistantMessageId, (message) => ({
      ...message,
      content: `${message.content}${contentChunk}`,
    }));
  }

  function flushPendingRevealContent() {
    if (!pendingRevealContentRef.current) {
      return;
    }

    const pendingContent = pendingRevealContentRef.current;
    pendingRevealContentRef.current = '';
    appendAssistantContent(pendingContent);
  }

  function finalizeAssistantRender() {
    const assistantMessageId = activeAssistantMessageIdRef.current;
    const pendingCompletion = pendingCompletionRef.current;

    if (!assistantMessageId || !pendingCompletion) {
      return;
    }

    const visibleAssistantContent = renderedAssistantContentRef.current.trim();

    updateAssistantMessage(assistantMessageId, (message) => ({
      ...message,
      content:
        visibleAssistantContent ||
        (pendingCompletion.streamFailed || pendingCompletion.wasAborted
          ? 'Generation stopped before completion.'
          : 'No response generated.'),
      pending: false,
      status:
        pendingCompletion.streamFailed || pendingCompletion.wasAborted
          ? 'failed'
          : 'completed',
    }));

    activeAssistantMessageIdRef.current = null;
    pendingCompletionRef.current = null;
    pendingRevealContentRef.current = '';
    renderedAssistantContentRef.current = '';
    revealModeRef.current = 'normal';
    revealLastTimestampRef.current = null;
    cancelRevealLoop();
    setIsProviderStreaming(false);
    setIsStreaming(false);
    invalidateChatQueries(pendingCompletion.threadId);
  }

  function maybeFinalizeAssistantRender() {
    if (isProviderStreamingRef.current || pendingRevealContentRef.current) {
      return;
    }

    finalizeAssistantRender();
  }

  function drainPendingRevealContent(timestamp: number) {
    revealFrameRef.current = null;
    revealFrameStrategyRef.current = null;

    if (!pendingRevealContentRef.current) {
      maybeFinalizeAssistantRender();
      return;
    }

    const minInterval =
      revealModeRef.current === 'finishing'
        ? Math.max(8, Math.floor(STREAM_REVEAL_MIN_INTERVAL_MS / 2))
        : STREAM_REVEAL_MIN_INTERVAL_MS;

    if (
      revealLastTimestampRef.current !== null &&
      timestamp - revealLastTimestampRef.current < minInterval
    ) {
      scheduleRevealLoop();
      return;
    }

    const nextChunk = takeNextRevealChunk({
      pendingContent: pendingRevealContentRef.current,
      revealMode: revealModeRef.current,
    });

    pendingRevealContentRef.current = pendingRevealContentRef.current.slice(
      nextChunk.length
    );
    revealLastTimestampRef.current = timestamp;
    appendAssistantContent(nextChunk);

    if (pendingRevealContentRef.current) {
      scheduleRevealLoop();
      return;
    }

    maybeFinalizeAssistantRender();
  }

  function scheduleRevealLoop() {
    if (revealFrameRef.current !== null) {
      return;
    }

    if (!pendingRevealContentRef.current) {
      maybeFinalizeAssistantRender();
      return;
    }

    revealFrameRef.current = requestRevealFrame(drainPendingRevealContent);
  }

  function enqueueAssistantDelta(delta: string) {
    if (!delta) {
      return;
    }

    pendingRevealContentRef.current = `${pendingRevealContentRef.current}${delta}`;
    scheduleRevealLoop();
  }

  function finalizeProviderStream({
    streamFailed,
    threadId,
    wasAborted,
  }: PendingAssistantCompletion) {
    isProviderStreamingRef.current = false;
    setIsProviderStreaming(false);
    pendingCompletionRef.current = {
      streamFailed,
      threadId,
      wasAborted,
    };

    if (wasAborted) {
      flushPendingRevealContent();
      finalizeAssistantRender();
      return;
    }

    revealModeRef.current = 'finishing';
    maybeFinalizeAssistantRender();
    scheduleRevealLoop();
  }

  const resumeTranscriptFollow = () => {
    setTranscriptFollowState(true);
    scrollTranscriptToBottom({ smooth: true });
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const startNewChat = () => {
    abortControllerRef.current?.abort();
    setTranscriptFollowState(true);
    setDraft('');
    setErrorMessage('');
    setMessages([]);
    setSelectedThreadInUrl(null);
  };

  const handleTranscriptScroll = () => {
    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    setTranscriptFollowState(isTranscriptNearBottom(transcriptElement));
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

    cancelRevealLoop();
    activeAssistantMessageIdRef.current = assistantMessageId;
    pendingRevealContentRef.current = '';
    renderedAssistantContentRef.current = '';
    revealLastTimestampRef.current = null;
    revealModeRef.current = 'normal';
    pendingCompletionRef.current = null;
    isProviderStreamingRef.current = true;
    setTranscriptFollowState(true);
    setDraft('');
    setErrorMessage('');
    setIsStreaming(true);
    setIsProviderStreaming(true);
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
                enqueueAssistantDelta(streamEvent.delta);
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
              enqueueAssistantDelta(streamEvent.delta);
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
      finalizeProviderStream({
        streamFailed,
        threadId: activeThreadId,
        wasAborted,
      });
    }
  };

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
    <Surface variant="strong" className="overflow-hidden rounded-[2rem]">
      <div className="flex min-h-[680px] flex-col xl:flex-row">
        <aside className="xl:flex xl:w-[320px] xl:shrink-0 xl:flex-col xl:border-r xl:border-[var(--app-border)]">
          <div className="border-b border-[var(--app-border)] px-5 py-4 sm:px-6 xl:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Assistant Threads</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  General-purpose AI
                </h2>
                <p className="mt-2 text-sm leading-6 app-text-muted">
                  Stream responses, keep general prompts org-scoped, and reopen saved assistant threads later.
                </p>
              </div>
              <Button variant="ghost" onClick={startNewChat} disabled={isStreaming}>
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
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
                  New assistant thread
                </span>
                <span className="block truncate text-xs app-text-muted">
                  Start a fresh general AI conversation
                </span>
              </span>
            </button>

            {isThreadsLoading ? (
              <Surface variant="default" className="rounded-[1.4rem] p-4">
                <p className="text-sm app-text-muted">Loading assistant threads...</p>
              </Surface>
            ) : null}

            {!isThreadsLoading && threads.length === 0 ? (
              <Surface variant="default" className="rounded-[1.4rem] p-4">
                <p className="text-sm app-text-muted">
                  Your first assistant message will create a saved thread here.
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
              <p className="app-kicker">
                {selectedThread ? 'Saved Assistant Thread' : 'Assistant Draft'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {selectedThread?.title ?? 'New assistant conversation'}
              </h2>
              <p className="mt-2 text-sm leading-6 app-text-muted">
                {selectedThread?.summary ??
                  (runtime.available
                    ? 'Use the assistant for open-ended product, execution, and team questions.'
                    : 'This environment is reserved for the future cloud provider. Assistant chat is disabled until that adapter is configured.')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>
                <Bot className="h-3.5 w-3.5" />
                {runtime.providerLabel}
              </Badge>
              <Badge>{runtime.model}</Badge>
              {isProviderStreaming ? (
                <Button variant="ghost" onClick={stopGeneration}>
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative">
            <div
              ref={transcriptRef}
              onScroll={handleTranscriptScroll}
              className="max-h-[58vh] min-h-[380px] space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
            >
              {isSelectedThreadLoading && selectedThreadId ? (
                <Surface variant="default" className="rounded-[1.6rem] p-6">
                  <p className="app-kicker">Loading Thread</p>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">
                    Rehydrating saved assistant conversation...
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
                    Start the next assistant conversation
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 app-text-muted">
                    Ask the general assistant about planning ideas, product questions, sprint summaries, or the next MVP step.
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
                          {message.role === 'user' ? 'You' : 'Axxon Assistant'}
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

            {showJumpToLatest ? (
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resumeTranscriptFollow}
                  className="pointer-events-auto rounded-full border-[color-mix(in_srgb,var(--app-accent)_24%,var(--app-border))] bg-[color-mix(in_srgb,var(--app-panel-strong)_88%,transparent)] px-4 shadow-[0_18px_40px_rgba(15,23,42,0.34)] backdrop-blur-md"
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--app-highlight)]" />
                  <ArrowDown className="h-4 w-4" />
                  Jump to latest
                </Button>
              </div>
            ) : null}
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
                    ? 'Ask the assistant about planning, execution, or the next MVP step...'
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
  );
}
