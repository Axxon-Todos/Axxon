// Covers org AI controller authorization and request validation before provider execution begins.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockedRequireOrganizationMember,
  mockedCreateAiChatEventStream,
} = vi.hoisted(() => ({
  mockedRequireOrganizationMember: vi.fn(),
  mockedCreateAiChatEventStream: vi.fn(),
}));

vi.mock('@/lib/utils/authorization', () => ({
  requireOrganizationMember: mockedRequireOrganizationMember,
}));

vi.mock('@/lib/ai/service', () => ({
  createAiChatEventStream: mockedCreateAiChatEventStream,
}));

import { BadRequestError } from '@/lib/utils/apiErrors';
import { createOrganizationAiChatStream } from '@/lib/controllers/ai/organizationAiControllers';

describe('organizationAiControllers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireOrganizationMember.mockResolvedValue({ id: 3 });
    mockedCreateAiChatEventStream.mockResolvedValue({
      runtime: {
        stage: 'development',
        provider: 'local-ollama',
        providerLabel: 'Local Ollama',
        model: 'qwen2.5-coder:14b',
        available: true,
        statusLabel: 'Configured',
      },
      stream: new ReadableStream(),
    });
  });

  it('authorizes org members and forwards normalized messages to the AI service', async () => {
    await createOrganizationAiChatStream({
      organizationId: 3,
      sessionUserId: 12,
      data: {
        messages: [
          {
            role: 'user',
            content: '  Summarize the board status  ',
          },
        ],
      },
    });

    expect(mockedRequireOrganizationMember).toHaveBeenCalledWith(3, 12);
    expect(mockedCreateAiChatEventStream).toHaveBeenCalledWith({
      messages: [
        {
          role: 'user',
          content: 'Summarize the board status',
        },
      ],
    });
  });

  it('rejects payloads whose latest message is not from the user', async () => {
    await expect(
      createOrganizationAiChatStream({
        organizationId: 3,
        sessionUserId: 12,
        data: {
          messages: [
            {
              role: 'assistant',
              content: 'Ready when you are',
            },
          ],
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<BadRequestError>>({
        message: 'The latest AI chat message must be from the user',
      })
    );

    expect(mockedCreateAiChatEventStream).not.toHaveBeenCalled();
  });

  it('rejects invalid message payloads before hitting the AI service', async () => {
    await expect(
      createOrganizationAiChatStream({
        organizationId: 3,
        sessionUserId: 12,
        data: {
          messages: [
            {
              role: 'user',
              content: '   ',
            },
          ],
        },
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<BadRequestError>>({
        message: 'Invalid AI chat payload',
      })
    );

    expect(mockedCreateAiChatEventStream).not.toHaveBeenCalled();
  });
});
