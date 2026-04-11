// Validates org-scoped AI chat requests and forwards normalized transcripts to the active provider.
import { z } from 'zod';
import { createAiChatEventStream } from '@/lib/ai/service';
import type { AiChatMessage } from '@/lib/types/aiTypes';
import { BadRequestError } from '@/lib/utils/apiErrors';
import { requireOrganizationMember } from '@/lib/utils/authorization';

const aiChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

const aiChatRequestSchema = z.object({
  messages: z.array(aiChatMessageSchema).min(1).max(24),
});

// Trim stored transcript content and require the final message to be the new user prompt.
function normalizeMessages(messages: AiChatMessage[]) {
  const normalizedMessages = messages.map((message) => ({
    ...message,
    content: message.content.trim(),
  }));

  if (normalizedMessages[normalizedMessages.length - 1]?.role !== 'user') {
    throw new BadRequestError('The latest AI chat message must be from the user');
  }

  return normalizedMessages;
}

// Enforce org membership and request-shape rules before provider work begins.
export async function createOrganizationAiChatStream({
  organizationId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  sessionUserId: number;
  data: unknown;
}) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationMember(organizationId, sessionUserId);

  const parsedRequest = aiChatRequestSchema.safeParse(data);

  if (!parsedRequest.success) {
    throw new BadRequestError('Invalid AI chat payload');
  }

  return createAiChatEventStream({
    messages: normalizeMessages(parsedRequest.data.messages),
  });
}
