// Verifies creator-scoped org AI chat thread listing and ordered message persistence helpers.
import { beforeEach, describe, expect, it } from 'vitest';

import { ChatMessages } from '@/lib/models/chatMessages';
import { ChatThreads } from '@/lib/models/chatThreads';

import { resetDatabase } from '../db';
import {
  addOrganizationMember,
  createChatMessageRecord,
  createChatThreadRecord,
  createOrganizationRecord,
  createUser,
} from '../factories';

describe('organization AI chat models', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lists only the creator threads ordered by most recently updated', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const teammate = await createUser({ email: 'teammate@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });

    await addOrganizationMember(organization.id, teammate.id);

    const firstThread = await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: owner.id,
      title: 'First thread',
      summary: 'First summary',
    });
    const secondThread = await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: owner.id,
      title: 'Second thread',
      summary: 'Second summary',
    });

    await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: teammate.id,
      title: 'Private teammate thread',
      summary: 'Teammate summary',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await ChatThreads.touchThread(firstThread.id);

    const threads = await ChatThreads.listThreadsForUser({
      organizationId: organization.id,
      userId: owner.id,
    });

    expect(threads.map((thread) => thread.id)).toEqual([
      firstThread.id,
      secondThread.id,
    ]);
  });

  it('reconstructs thread messages in sequence order and returns the next sequence', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const thread = await createChatThreadRecord({
      organizationId: organization.id,
      createdBy: owner.id,
    });

    await createChatMessageRecord({
      threadId: thread.id,
      role: 'user',
      content: 'First question',
      sequenceNumber: 1,
    });
    await createChatMessageRecord({
      threadId: thread.id,
      role: 'assistant',
      content: 'First answer',
      sequenceNumber: 2,
      model: 'qwen2.5-coder:14b',
    });
    await createChatMessageRecord({
      threadId: thread.id,
      role: 'user',
      content: 'Second question',
      sequenceNumber: 3,
    });

    const messages = await ChatMessages.listMessagesForThread(thread.id);
    const nextSequenceNumber = await ChatMessages.getNextSequenceNumber(thread.id);

    expect(messages.map((message) => message.sequence_number)).toEqual([1, 2, 3]);
    expect(messages[1]?.model).toBe('qwen2.5-coder:14b');
    expect(nextSequenceNumber).toBe(4);
  });
});
