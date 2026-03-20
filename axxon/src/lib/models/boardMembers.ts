import knex from '@/lib/db/db';
import type {
  AddBoardMembersByEmail,
  BoardMembersBaseData,
  GetAllMembersForBoard,
  GetMemberById,
  ListBoardsForUser,
  RemoveBoardMember,
} from '../types/boardMemberTypes';
import type { BoardBaseData } from '../types/boardTypes';
import type { User } from '../types/users';
import { Conversations } from './conversations';

export class BoardMembers {
  static async listBoardsForUser(data: ListBoardsForUser): Promise<BoardBaseData[]> {
    return knex('boards')
      .join('board_members', 'boards.id', 'board_members.board_id')
      .where('board_members.user_id', data.user_id)
      .select('boards.*')
      .orderBy('boards.created_at', 'desc');
  }

  static async listBoardsForOrganization(data: {
    organization_id: number;
    user_id: number;
  }): Promise<BoardBaseData[]> {
    return knex('boards')
      .join('board_members', 'boards.id', 'board_members.board_id')
      .where('boards.organization_id', data.organization_id)
      .where('board_members.user_id', data.user_id)
      .select('boards.*')
      .orderBy('boards.created_at', 'desc');
  }

  static async getAllMembersForBoard(data: GetAllMembersForBoard): Promise<User[]> {
    return knex('users')
      .join('board_members', 'users.id', 'board_members.user_id')
      .where('board_members.board_id', data.board_id)
      .select('users.*');
  }

  static async removeMember(data: RemoveBoardMember): Promise<number> {
    return knex('board_members')
      .where({ user_id: data.user_id, board_id: data.board_id })
      .del();
  }

  static async addMembersByEmail(data: AddBoardMembersByEmail): Promise<void> {
    const users = await knex('users')
      .join('organization_members', 'users.id', 'organization_members.user_id')
      .where('organization_members.organization_id', data.organization_id)
      .whereIn('users.email', data.emails)
      .select('users.id');

    if (users.length === 0) return;

    const existingMembers = await knex('board_members')
      .where({ board_id: data.board_id })
      .whereIn(
        'user_id',
        users.map((user) => user.id)
      )
      .select('user_id');

    const existingMemberIds = new Set(
      existingMembers.map((member) => member.user_id)
    );
    const newUsers = users.filter((user) => !existingMemberIds.has(user.id));

    if (newUsers.length === 0) return;

    const memberInserts = newUsers.map((user) => ({
      user_id: user.id,
      board_id: data.board_id,
    }));

    await knex('board_members').insert(memberInserts);

    const mainConvo = await Conversations.getConversationByBoardId(data.board_id);

    if (!mainConvo) return;

    const existingConversationMembers = await knex('conversation_members')
      .where({ conversation_id: mainConvo.id })
      .whereIn(
        'user_id',
        newUsers.map((user) => user.id)
      )
      .select('user_id');

    const existingConversationMemberIds = new Set(
      existingConversationMembers.map((member) => member.user_id)
    );

    const conversationMemberInserts = newUsers
      .filter((user) => !existingConversationMemberIds.has(user.id))
      .map((user) => ({
        conversation_id: mainConvo.id,
        user_id: user.id,
      }));

    if (conversationMemberInserts.length > 0) {
      await knex('conversation_members').insert(conversationMemberInserts);
    }
  }

  static async getMemberById(
    data: GetMemberById
  ): Promise<BoardMembersBaseData | null> {
    return (
      (await knex('board_members')
        .where({ user_id: data.user_id, board_id: data.board_id })
        .first()) || null
    );
  }

  static async isMember(data: GetMemberById): Promise<boolean> {
    const membership = await knex('board_members')
      .where({ user_id: data.user_id, board_id: data.board_id })
      .first();

    return Boolean(membership);
  }
}
