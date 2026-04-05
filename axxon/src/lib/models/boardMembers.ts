import knex from '@/lib/db/db';
import type {
  AddBoardMembers,
  BoardMembersBaseData,
  GetAllMembersForBoard,
  GetMemberById,
  ListBoardsForUser,
  RemoveBoardMember,
} from '../types/boardMemberTypes';
import type { BoardBaseData } from '../types/boardTypes';
import type { User } from '../types/users';

function applyUserSearch(
  queryBuilder: ReturnType<typeof knex>,
  query: string
) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return queryBuilder;
  }

  const searchPattern = `%${trimmedQuery}%`;

  return queryBuilder.andWhere((builder) => {
    builder
      .where('users.email', 'ilike', searchPattern)
      .orWhere('users.first_name', 'ilike', searchPattern)
      .orWhere('users.last_name', 'ilike', searchPattern)
      .orWhereRaw(
        `concat_ws(' ', users.first_name, users.last_name) ilike ?`,
        [searchPattern]
      );
  });
}

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

  static async listInviteCandidates({
    organizationId,
    boardId,
    query,
  }: {
    organizationId: number;
    boardId: number;
    query: string;
  }): Promise<User[]> {
    const queryBuilder = knex('users')
      .join('organization_members', 'users.id', 'organization_members.user_id')
      .where('organization_members.organization_id', organizationId)
      .whereNotExists(function excludeCurrentBoardMembers() {
        this.select(knex.raw('1'))
          .from('board_members')
          .whereRaw('board_members.user_id = users.id')
          .andWhere('board_members.board_id', boardId);
      })
      .select('users.*')
      .orderBy('users.first_name', 'asc')
      .orderBy('users.last_name', 'asc')
      .orderBy('users.email', 'asc');

    return applyUserSearch(queryBuilder, query);
  }

  static async addMembersByUserIds(data: AddBoardMembers): Promise<number> {
    if (data.user_ids.length === 0) {
      return 0;
    }

    return knex.transaction(async (trx) => {
      const existingMembers = await trx('board_members')
        .where({ board_id: data.board_id })
        .whereIn('user_id', data.user_ids)
        .select('user_id');

      const existingMemberIds = new Set(
        existingMembers.map((member) => member.user_id)
      );
      const newUserIds = data.user_ids.filter((userId) => !existingMemberIds.has(userId));

      if (newUserIds.length === 0) {
        return 0;
      }

      await trx('board_members').insert(
        newUserIds.map((userId) => ({
          user_id: userId,
          board_id: data.board_id,
        }))
      );

      const mainConvo = await trx('conversations')
        .where({ board_id: data.board_id })
        .first();

      if (!mainConvo) {
        return newUserIds.length;
      }

      const existingConversationMembers = await trx('conversation_members')
        .where({ conversation_id: mainConvo.id })
        .whereIn('user_id', newUserIds)
        .select('user_id');

      const existingConversationMemberIds = new Set(
        existingConversationMembers.map((member) => member.user_id)
      );

      const conversationMemberInserts = newUserIds
        .filter((userId) => !existingConversationMemberIds.has(userId))
        .map((userId) => ({
          conversation_id: mainConvo.id,
          user_id: userId,
        }));

      if (conversationMemberInserts.length > 0) {
        await trx('conversation_members').insert(conversationMemberInserts);
      }

      return newUserIds.length;
    });
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
