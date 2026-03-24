// Defines the persisted and API shapes for board-to-repository access links.
import type { BoardBaseData } from '@/lib/types/boardTypes';
import type { RepositoryRecord } from '@/lib/types/githubIntegrationTypes';

export type BoardRepositoryAccessBaseData = {
  board_id: number;
  repository_id: number;
  created_at: string;
};

export type BoardRepositoryLinkRecord = Pick<
  BoardRepositoryAccessBaseData,
  'board_id' | 'repository_id'
>;

export type BoardRepositoriesResponse = {
  repositories: RepositoryRecord[];
};

export type BoardRepositoryAccessMatrixResponse = {
  boards: BoardBaseData[];
  repositories: RepositoryRecord[];
  links: BoardRepositoryLinkRecord[];
};
