import { beforeEach, describe, expect, it } from 'vitest';

import { Conversations } from '@/lib/models/conversations';

import { resetDatabase } from '../db';
import { createBoardRecord, createConversationRecord, createUser } from '../factories';

describe('Conversations model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('looks up a board conversation by board id instead of conversation id', async () => {
    const creator = await createUser();
    await createBoardRecord({ createdBy: creator.id });
    const targetBoard = await createBoardRecord({ createdBy: creator.id });

    const conversation = await createConversationRecord({
      boardId: targetBoard.id,
      title: 'Target board chat',
    });

    const foundConversation = await Conversations.getConversationByBoardId(targetBoard.id);

    expect(foundConversation?.id).toBe(conversation.id);
    expect(foundConversation?.board_id).toBe(targetBoard.id);
  });
});
