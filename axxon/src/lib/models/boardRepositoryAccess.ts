// Persists and queries the explicit repository allowlist assigned to each board.
import db from '@/lib/db/db';
import type {
  BoardRepositoryLinkRecord,
} from '@/lib/types/boardRepositoryAccessTypes';
import type { RepositoryRecord } from '@/lib/types/githubIntegrationTypes';

export class BoardRepositoryAccess {
  static async listRepositoriesForBoard(
    boardId: number
  ): Promise<RepositoryRecord[]> {
    return db('repositories')
      .join(
        'board_repository_access',
        'repositories.id',
        'board_repository_access.repository_id'
      )
      .where('board_repository_access.board_id', boardId)
      .where('repositories.is_active', true)
      .select('repositories.*')
      .orderBy('repositories.full_name', 'asc');
  }

  static async listLinksForOrganization(
    organizationId: number
  ): Promise<BoardRepositoryLinkRecord[]> {
    return db('board_repository_access')
      .join('boards', 'boards.id', 'board_repository_access.board_id')
      .join(
        'repositories',
        'repositories.id',
        'board_repository_access.repository_id'
      )
      .where('boards.organization_id', organizationId)
      .where('repositories.organization_id', organizationId)
      .where('repositories.is_active', true)
      .select(
        'board_repository_access.board_id',
        'board_repository_access.repository_id'
      )
      .orderBy('board_repository_access.board_id', 'asc')
      .orderBy('board_repository_access.repository_id', 'asc');
  }

  static async replaceRepositoriesForBoard({
    boardId,
    repositoryIds,
  }: {
    boardId: number;
    repositoryIds: number[];
  }): Promise<void> {
    await db.transaction(async (trx) => {
      if (repositoryIds.length === 0) {
        await trx('board_repository_access').where({ board_id: boardId }).del();
        return;
      }

      await trx('board_repository_access')
        .where({ board_id: boardId })
        .whereNotIn('repository_id', repositoryIds)
        .del();

      const existingLinks = await trx('board_repository_access')
        .where({ board_id: boardId })
        .whereIn('repository_id', repositoryIds)
        .select('repository_id');

      const existingRepositoryIds = new Set(
        existingLinks.map((link) => link.repository_id)
      );
      const repositoryIdsToInsert = repositoryIds.filter(
        (repositoryId) => !existingRepositoryIds.has(repositoryId)
      );

      if (repositoryIdsToInsert.length === 0) {
        return;
      }

      await trx('board_repository_access').insert(
        repositoryIdsToInsert.map((repositoryId) => ({
          board_id: boardId,
          repository_id: repositoryId,
          created_at: db.fn.now(),
        }))
      );
    });
  }
}
