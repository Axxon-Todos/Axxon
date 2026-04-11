// Renders the org-scoped AI chat workspace and streams replies from the active backend provider.
'use client';

import Link from 'next/link';
import type { FormEvent, KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  LoaderCircle,
  Send,
  Sparkles,
  Square,
  Trash2,
  User2,
} from 'lucide-react';

import Badge from '@/components/ui/Badge';
import Button, { buttonClassName } from '@/components/ui/Button';
import PageHero from '@/components/ui/PageHero';
import Surface from '@/components/ui/Surface';
import { streamOrganizationAiChat } from '@/lib/api/organizations/streamOrganizationAiChat';
import { fetchOrganization } from '@/lib/api/organizations/getOrganization';
import type {
  AiChatMessage,
  AiRuntimeSummary,
  AiStreamEvent,
} from '@/lib/types/aiTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

type ChatMessage = AiChatMessage & {
  id: string;
  pending?: boolean;
};

// Give each in-memory transcript item a stable key without introducing server-side persistence yet.
function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Abort is a normal user action here, so the UI should not surface it as an error.
function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => fetchOrganization(organizationId),
  });

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== 'system'),
    [messages]
  );

  // Keep the latest exchange visible as new assistant tokens stream in.
  useEffect(() => {
    const transcriptElement = transcriptRef.current;

    if (!transcriptElement) {
      return;
    }

    transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }, [visibleMessages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
  const canSend = runtime.available && draft.trim().length > 0 && !isStreaming;

  const updateAssistantMessage = (
    assistantMessageId: string,
    updater: (message: ChatMessage) => ChatMessage | null
  ) => {
    // Replace only the placeholder assistant row created for the active request.
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
    };
    const assistantMessageId = createMessageId();
    const requestMessages: AiChatMessage[] = [
      ...messages.map((message): AiChatMessage => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'user',
        content: trimmedDraft,
      },
    ];

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
        pending: true,
      },
    ]);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await streamOrganizationAiChat({
        organizationId,
        messages: requestMessages,
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await readAiError(response));
      }

      // Read NDJSON events as they arrive so the assistant bubble updates token-by-token.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamFailed = false;

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

      if (streamFailed) {
        updateAssistantMessage(assistantMessageId, (message) =>
          message.content.trim() ? { ...message, pending: false } : null
        );
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to get the AI response'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      updateAssistantMessage(assistantMessageId, (message) =>
        message.content.trim() ? { ...message, pending: false } : null
      );
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
        description="Validate the first AI-driven MVP flow with a ChatGPT-like org surface backed by the active Axxon AI runtime."
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
            <Button
              variant="ghost"
              onClick={() => {
                abortControllerRef.current?.abort();
                setMessages([]);
                setErrorMessage('');
                setDraft('');
              }}
              disabled={messages.length === 0 && !draft}
            >
              <Trash2 className="h-4 w-4" />
              Clear Chat
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4 sm:px-6">
          <div>
            <p className="app-kicker">Beta Chat</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              MVP conversation surface
            </h2>
            <p className="mt-2 text-sm leading-6 app-text-muted">
              {runtime.available
                ? 'Messages stream through the org-scoped AI route to the local Ollama container in this environment.'
                : 'This environment is reserved for the future cloud provider. Chat is disabled until that adapter is configured.'}
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
          {visibleMessages.length === 0 ? (
            <Surface variant="default" className="rounded-[1.6rem] p-6">
              <p className="app-kicker">Empty State</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">
                Start the first org-level AI conversation
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-text-muted">
                Ask for a sprint summary, planning help, or a repo-aware next step once
                deeper context tooling is added. For this MVP, the chat transcript stays in
                the browser and streams directly from the configured AI provider.
              </p>
            </Surface>
          ) : (
            visibleMessages.map((message) => (
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
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                      {message.content || 'Thinking...'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
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
      </Surface>
    </div>
  );
}
