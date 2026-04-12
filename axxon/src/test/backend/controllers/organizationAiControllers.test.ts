// Covers persisted org AI chat thread creation, continuation, and creator-only access rules.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedCreateAiChatEventStream,
  mockedGenerateAiThreadMetadata,
} = vi.hoisted(() => ({
  mockedCreateAiChatEventStream: vi.fn(),
  mockedGenerateAiThreadMetadata: vi.fn(),
}));

vi.mock('@/lib/ai/service', () => ({
  createAiChatEventStream: mockedCreateAiChatEventStream,
  generateAiThreadMetadata: mockedGenerateAiThreadMetadata,
}));

import {
  createOrganizationAiChatStream,
  getOrganizationAiThread,
} from '@/lib/controllers/ai/organizationAiControllers';
import { ForbiddenError } from '@/lib/utils/apiErrors';

import { resetDatabase } from '../db';
import {
  addOrganizationMember,
  createChatMessageRecord,
  createChatThreadRecord,
  createOrganizationRecord,
  createUser,
} from '../factories';

function createMockStreamResponse(content: string) {
  return {
    runtime: {
      stage: 'development',
      provider: 'local-ollama' as const,
      providerLabel: 'Local Ollama',
      model: 'qwen2.5-coder:14b',
      available: true,
      statusLabel: 'Configured',
    },
    stream: new ReadableStream<Uint8Array>(),
    completion: Promise.resolve({
      provider: 'local-ollama' as const,
      model: 'qwen2.5-coder:14b',
      content,
      status: 'completed' as const,
    }),
  };
}

async function waitForPersistedMessageCount({
  organizationId,
  threadId,
  sessionUserId,
  count,
}: {
  organizationId: number;
  threadId: number;
  sessionUserId: number;
  count: number;
}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const persistedThread = await getOrganizationAiThread({
      organizationId,
      threadId,
      sessionUserId,
    });

    if (persistedThread.messages.length === count) {
      return persistedThread;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for ${count} persisted messages`);
}

describe('organizationAiControllers', () => {
  beforeEach(async () => {
    await resetDatabase();
    vi.clearAllMocks();
    mockedGenerateAiThreadMetadata.mockResolvedValue({
      title: 'Sprint planning chat',
      summary: 'Plan the next sprint.',
    });
    mockedCreateAiChatEventStream.mockResolvedValue(
      createMockStreamResponse('## Plan\n\n- Scope the sprint')
    );
  });

  it('creates a new persisted thread and appends the assistant response after completion', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });

    const response = await createOrganizationAiChatStream({
      organizationId: organization.id,
      sessionUserId: owner.id,
      data: {
        content: '  Plan the next sprint  ',
      },
    });

    expect(mockedGenerateAiThreadMetadata).toHaveBeenCalledWith({
      conversationStarter: 'Plan the next sprint',
    });
    expect(mockedCreateAiChatEventStream).toHaveBeenCalledWith({
      messages: [
        {
          role: 'system',
          content:
            'Respond in clear GitHub-flavored Markdown when it improves readability. Use short headings, bullet lists, tables, and fenced code blocks when useful, but keep very short answers concise.',
        },
        {
          role: 'user',
          content: 'Plan the next sprint',
        },
      ],
    });

    await response.completion;

    const persistedThread = await waitForPersistedMessageCount({
      organizationId: organization.id,
      threadId: response.threadId,
      sessionUserId: owner.id,
      count: 2,
    });

    expect(persistedThread.thread.title).toBe('Sprint planning chat');
    expect(persistedThread.thread.summary).toBe('Plan the next sprint.');
    expect(
      persistedThread.messages.map((message) => ({
        role: message.role,
        content: message.content,
        sequence: message.sequence_number,
        status: message.status,
        model: message.model,
      }))
    ).toEqual([
      {
        role: 'user',
        content: 'Plan the next sprint',
        sequence: 1,
        status: 'completed',
        model: null,
      },
      {
        role: 'assistant',
        content: '## Plan\n\n- Scope the sprint',
        sequence: 2,
        status: 'completed',
        model: 'qwen2.5-coder:14b',
      },
    ]);
  });

  it('rebuilds persisted history when appending to an existing thread', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const thread = await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: owner.id,
      title: 'Existing thread',
      summary: 'Existing summary',
    });

    await createChatMessageRecord({
      threadId: thread.id,
      role: 'user',
      content: 'Summarize the board',
      sequenceNumber: 1,
    });
    await createChatMessageRecord({
      threadId: thread.id,
      role: 'assistant',
      content: 'Board summary',
      sequenceNumber: 2,
      model: 'qwen2.5-coder:14b',
    });

    const response = await createOrganizationAiChatStream({
      organizationId: organization.id,
      sessionUserId: owner.id,
      data: {
        threadId: thread.id,
        content: 'Add sprint suggestions',
      },
    });

    expect(mockedGenerateAiThreadMetadata).not.toHaveBeenCalled();
    expect(mockedCreateAiChatEventStream).toHaveBeenCalledWith({
      messages: [
        {
          role: 'system',
          content:
            'Respond in clear GitHub-flavored Markdown when it improves readability. Use short headings, bullet lists, tables, and fenced code blocks when useful, but keep very short answers concise.',
        },
        {
          role: 'user',
          content: 'Summarize the board',
        },
        {
          role: 'assistant',
          content: 'Board summary',
        },
        {
          role: 'user',
          content: 'Add sprint suggestions',
        },
      ],
    });

    await response.completion;

    const persistedThread = await waitForPersistedMessageCount({
      organizationId: organization.id,
      threadId: thread.id,
      sessionUserId: owner.id,
      count: 4,
    });

    expect(persistedThread.messages.map((message) => message.sequence_number)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(persistedThread.messages[2]?.content).toBe('Add sprint suggestions');
    expect(persistedThread.messages[3]?.role).toBe('assistant');
  });

  it('blocks other organization members from opening a creator-owned thread', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const teammate = await createUser({ email: 'teammate@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });

    await addOrganizationMember(organization.id, teammate.id);

    const thread = await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: owner.id,
      title: 'Owner thread',
      summary: 'Owner only',
    });

    await expect(
      getOrganizationAiThread({
        organizationId: organization.id,
        threadId: thread.id,
        sessionUserId: teammate.id,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<ForbiddenError>>({
        message: 'You do not have access to this chat thread',
      })
    );
  });
});
