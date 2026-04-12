// Orchestrates org-scoped AI chat persistence, thread reads, and streaming assistant replies.
import { z } from 'zod';

import { getAiRuntimeSummary } from '@/lib/ai/config';
import {
  createAiChatEventStream,
  generateAiThreadMetadata,
} from '@/lib/ai/service';
import db from '@/lib/db/db';
import { ChatMessages } from '@/lib/models/chatMessages';
import { ChatThreads } from '@/lib/models/chatThreads';
import type { AiChatMessage } from '@/lib/types/aiTypes';
import type {
  OrganizationAiChatRequest,
  OrganizationAiChatThreadDetail,
} from '@/lib/types/organizationAiChatTypes';
import { BadRequestError } from '@/lib/utils/apiErrors';
import {
  requireOrganizationAiThreadCreator,
  requireOrganizationMember,
} from '@/lib/utils/authorization';

const aiChatRequestSchema = z.object({
  threadId: z.number().int().positive().optional(),
  content: z.string().trim().min(1).max(4000),
});

const MARKDOWN_RESPONSE_SYSTEM_MESSAGE: AiChatMessage = {
  role: 'system',
  content:
    'Respond in clear GitHub-flavored Markdown when it improves readability. Use short headings, bullet lists, tables, and fenced code blocks when useful, but keep very short answers concise.',
};

function normalizeOrganizationId(organizationId: number) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  return organizationId;
}

function normalizeThreadId(threadId: number) {
  if (!Number.isFinite(threadId)) {
    throw new BadRequestError('Invalid thread id');
  }

  return threadId;
}

function buildProviderMessages(messages: OrganizationAiChatThreadDetail['messages']) {
  return [
    MARKDOWN_RESPONSE_SYSTEM_MESSAGE,
    ...messages.map(
      (message): AiChatMessage => ({
        role: message.role,
        content: message.content,
      })
    ),
  ];
}

async function createThreadWithInitialMessage({
  organizationId,
  sessionUserId,
  content,
}: {
  organizationId: number;
  sessionUserId: number;
  content: string;
}) {
  const metadata = await generateAiThreadMetadata({
    conversationStarter: content,
  });

  return db.transaction(async (trx) => {
    const thread = await ChatThreads.createThread(
      {
        organizationId,
        createdBy: sessionUserId,
        title: metadata.title,
        summary: metadata.summary,
      },
      trx
    );
    const userMessage = await ChatMessages.createMessage(
      {
        threadId: thread.id,
        role: 'user',
        content,
        sequenceNumber: 1,
        status: 'completed',
      },
      trx
    );

    return {
      thread,
      messages: [userMessage],
    };
  });
}

async function appendUserMessageToThread({
  organizationId,
  threadId,
  sessionUserId,
  content,
}: {
  organizationId: number;
  threadId: number;
  sessionUserId: number;
  content: string;
}) {
  await requireOrganizationAiThreadCreator(organizationId, threadId, sessionUserId);

  return db.transaction(async (trx) => {
    const thread = await ChatThreads.lockThreadById(threadId, trx);

    if (!thread || thread.organization_id !== organizationId || thread.created_by !== sessionUserId) {
      throw new BadRequestError('Invalid chat thread');
    }

    const messages = await ChatMessages.listMessagesForThread(threadId, trx);
    const sequenceNumber = await ChatMessages.getNextSequenceNumber(threadId, trx);
    const userMessage = await ChatMessages.createMessage(
      {
        threadId,
        role: 'user',
        content,
        sequenceNumber,
        status: 'completed',
      },
      trx
    );

    await ChatThreads.touchThread(threadId, trx);

    return {
      thread,
      messages: [...messages, userMessage],
    };
  });
}

async function appendAssistantMessage({
  threadId,
  content,
  status,
  model,
}: {
  threadId: number;
  content: string;
  status: 'completed' | 'failed';
  model: string;
}) {
  await db.transaction(async (trx) => {
    const thread = await ChatThreads.lockThreadById(threadId, trx);

    if (!thread) {
      return;
    }

    const sequenceNumber = await ChatMessages.getNextSequenceNumber(threadId, trx);

    await ChatMessages.createMessage(
      {
        threadId,
        role: 'assistant',
        content:
          content.trim() ||
          (status === 'failed'
            ? 'Failed to complete the AI response.'
            : 'No response generated.'),
        sequenceNumber,
        status,
        model,
      },
      trx
    );
    await ChatThreads.touchThread(threadId, trx);
  });
}

export async function listOrganizationAiThreads({
  organizationId,
  sessionUserId,
}: {
  organizationId: number;
  sessionUserId: number;
}) {
  normalizeOrganizationId(organizationId);
  await requireOrganizationMember(organizationId, sessionUserId);

  return ChatThreads.listThreadsForUser({
    organizationId,
    userId: sessionUserId,
  });
}

export async function getOrganizationAiThread({
  organizationId,
  threadId,
  sessionUserId,
}: {
  organizationId: number;
  threadId: number;
  sessionUserId: number;
}): Promise<OrganizationAiChatThreadDetail> {
  normalizeOrganizationId(organizationId);
  normalizeThreadId(threadId);

  const thread = await requireOrganizationAiThreadCreator(
    organizationId,
    threadId,
    sessionUserId
  );

  return {
    thread,
    messages: await ChatMessages.listMessagesForThread(threadId),
  };
}

export async function createOrganizationAiChatStream({
  organizationId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  sessionUserId: number;
  data: unknown;
}) {
  normalizeOrganizationId(organizationId);
  await requireOrganizationMember(organizationId, sessionUserId);

  const parsedRequest = aiChatRequestSchema.safeParse(data);

  if (!parsedRequest.success) {
    throw new BadRequestError('Invalid AI chat payload');
  }

  const request: OrganizationAiChatRequest = parsedRequest.data;
  const content = request.content.trim();
  const persistedThread = request.threadId
    ? await appendUserMessageToThread({
        organizationId,
        threadId: normalizeThreadId(request.threadId),
        sessionUserId,
        content,
      })
    : await createThreadWithInitialMessage({
        organizationId,
        sessionUserId,
        content,
      });
  const providerMessages = buildProviderMessages(persistedThread.messages);

  try {
    const response = await createAiChatEventStream({
      messages: providerMessages,
    });

    void response.completion
      .then(async (completion) => {
        await appendAssistantMessage({
          threadId: persistedThread.thread.id,
          content: completion.content,
          status: completion.status,
          model: completion.model,
        });
      })
      .catch((error) => {
        console.error('[ORGANIZATION_AI_CHAT_PERSISTENCE_ERROR]', error);
      });

    return {
      ...response,
      threadId: persistedThread.thread.id,
    };
  } catch (error) {
    await appendAssistantMessage({
      threadId: persistedThread.thread.id,
      content:
        error instanceof Error ? error.message : 'Failed to process the AI chat request',
      status: 'failed',
      model: getAiRuntimeSummary().model,
    });

    throw error;
  }
}
