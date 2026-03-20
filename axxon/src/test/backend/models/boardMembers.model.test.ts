import { beforeEach, describe, expect, it } from 'vitest';

import { BoardMembers } from '@/lib/models/boardMembers';

import { db, resetDatabase } from '../db';
import {
  addOrganizationMember,
  addBoardMember,
  createBoardRecord,
  createConversationRecord,
  createUser,
} from '../factories';

describe('BoardMembers model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('adds only existing non-members and syncs them to the board conversation', async () => {
    const creator = await createUser({ email: 'creator@example.com' });
    const existingMember = await createUser({ email: 'existing@example.com' });
    const invitee = await createUser({ email: 'invitee@example.com' });

    const board = await createBoardRecord({ createdBy: creator.id });
    await addOrganizationMember(board.organization_id, existingMember.id);
    await addOrganizationMember(board.organization_id, invitee.id);
    await addBoardMember(board.id, creator.id);
    await addBoardMember(board.id, existingMember.id);

    const conversation = await createConversationRecord({
      boardId: board.id,
      title: 'Main Board Chat',
    });

    await db('conversation_members').insert([
      { conversation_id: conversation.id, user_id: creator.id },
      { conversation_id: conversation.id, user_id: existingMember.id },
    ]);

    await BoardMembers.addMembersByEmail({
      board_id: board.id,
      organization_id: board.organization_id,
      emails: [existingMember.email, invitee.email, 'missing@example.com'],
    });

    const boardMembers = await db('board_members')
      .where({ board_id: board.id })
      .orderBy('user_id', 'asc');
    const conversationMembers = await db('conversation_members')
      .where({ conversation_id: conversation.id })
      .orderBy('user_id', 'asc');

    expect(boardMembers.map((member) => member.user_id)).toEqual([
      creator.id,
      existingMember.id,
      invitee.id,
    ]);
    expect(conversationMembers.map((member) => member.user_id)).toEqual([
      creator.id,
      existingMember.id,
      invitee.id,
    ]);
  });

  it('returns boards for a user and reports membership status', async () => {
    const creator = await createUser();
    const collaborator = await createUser();
    const board = await createBoardRecord({ createdBy: creator.id });

    await addBoardMember(board.id, collaborator.id);

    const boards = await BoardMembers.listBoardsForUser({ user_id: collaborator.id });
    const isMember = await BoardMembers.isMember({
      board_id: board.id,
      user_id: collaborator.id,
    });

    expect(boards).toHaveLength(1);
    expect(boards[0]?.id).toBe(board.id);
    expect(isMember).toBe(true);
  });
});
