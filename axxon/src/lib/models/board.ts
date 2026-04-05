import knex from '@/lib/db/db';
import type {
  BoardBaseData,
  BoardCreation,
  DeleteBoard,
  ListBoardCreator,
  UpdateBoard,
} from '../types/boardTypes';

export class Board {
  static async createBoard(data: BoardCreation): Promise<BoardBaseData> {
    return knex.transaction(async (trx) => {
      const [board] = await trx('boards')
        .insert({
          name: data.name,
          organization_id: data.organization_id,
          created_by: data.created_by,
          color: data.color,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        })
        .returning('*');

      const defaultCategories = [
        { name: 'Backlog', color: '#94A3B8', is_done: false },
        { name: 'Todo', color: '#3B82F6', is_done: false },
        { name: 'In Progress', color: '#F59E0B', is_done: false },
        { name: 'Done', color: '#10B981', is_done: true },
        { name: 'Cancelled', color: '#EF4444', is_done: false },
      ];

      const categoryInserts = defaultCategories.map((category, index) => ({
        board_id: board.id,
        name: category.name,
        color: category.color,
        position: index,
        is_done: category.is_done,
      }));

      await trx('categories').insert(categoryInserts);

      const emails = data.member_emails ?? [];
      let invitedUsers: { id: number }[] = [];

      if (emails.length > 0) {
        invitedUsers = await trx('users')
          .join(
            'organization_members',
            'users.id',
            'organization_members.user_id'
          )
          .where('organization_members.organization_id', data.organization_id)
          .whereIn('users.email', emails)
          .select('users.id');
      }

      const memberInserts = [
        { board_id: board.id, user_id: data.created_by },
        ...invitedUsers.map((user) => ({
          board_id: board.id,
          user_id: user.id,
        })),
      ];

      await trx('board_members').insert(memberInserts);

      return board;
    });
  }

  static async updateBoard(data: UpdateBoard): Promise<BoardBaseData | null> {
    const { id, ...updateData } = data;

    const [board] = await knex('boards')
      .where({ id })
      .update({ ...updateData, updated_at: knex.fn.now() })
      .returning('*');

    return board || null;
  }

  static async deleteBoard(data: DeleteBoard): Promise<number> {
    return knex('boards').where({ id: data.id }).del();
  }

  static async listAllByCreator(data: ListBoardCreator): Promise<BoardBaseData[]> {
    return knex('boards')
      .where({ created_by: data.created_by })
      .orderBy('created_at', 'desc');
  }

  static async listAllInOrganization(
    organizationId: number
  ): Promise<BoardBaseData[]> {
    return knex('boards')
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');
  }

  static async getBoardById(id: number): Promise<BoardBaseData | null> {
    return (await knex('boards').where({ id }).first()) || null;
  }

  static async isCreator(boardId: number, userId: number): Promise<boolean> {
    const board = await knex('boards')
      .where({ id: boardId, created_by: userId })
      .first();

    return Boolean(board);
  }
}
