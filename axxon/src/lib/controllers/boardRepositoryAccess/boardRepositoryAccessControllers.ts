// Handles org-scoped board repository allowlist reads and writes for settings flows.
import { Board } from '@/lib/models/board';
import { BoardRepositoryAccess } from '@/lib/models/boardRepositoryAccess';
import { Repositories } from '@/lib/models/repositories';
import type {
  BoardRepositoriesResponse,
  BoardRepositoryAccessMatrixResponse,
} from '@/lib/types/boardRepositoryAccessTypes';
import {
  BadRequestError,
  NotFoundError,
} from '@/lib/utils/apiErrors';
import {
  requireBoardMember,
  requireOrganizationOwner,
} from '@/lib/utils/authorization';

export async function getBoardRepositories({
  organizationId,
  boardId,
  sessionUserId,
}: {
  organizationId: number;
  boardId: number;
  sessionUserId: number;
}): Promise<BoardRepositoriesResponse> {
  if (!Number.isFinite(organizationId) || !Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid organization or board id');
  }

  const board = await requireBoardMember(boardId, sessionUserId);

  if (board.organization_id !== organizationId) {
    throw new NotFoundError('Board not found');
  }

  return {
    repositories: await BoardRepositoryAccess.listRepositoriesForBoard(boardId),
  };
}

export async function replaceBoardRepositories({
  organizationId,
  boardId,
  sessionUserId,
  data,
}: {
  organizationId: number;
  boardId: number;
  sessionUserId: number;
  data: {
    repositoryIds: number[];
  };
}): Promise<BoardRepositoriesResponse> {
  if (!Number.isFinite(organizationId) || !Number.isFinite(boardId)) {
    throw new BadRequestError('Invalid organization or board id');
  }

  await requireOrganizationOwner(organizationId, sessionUserId);

  const board = await Board.getBoardById(boardId);

  if (!board || board.organization_id !== organizationId) {
    throw new NotFoundError('Board not found');
  }

  if (!Array.isArray(data.repositoryIds)) {
    throw new BadRequestError('repositoryIds must be an array');
  }

  const normalizedRepositoryIds = Array.from(
    new Set(
      data.repositoryIds.filter(
        (repositoryId) => Number.isFinite(repositoryId) && repositoryId > 0
      )
    )
  );

  const repositories = await Repositories.listByIdsForOrganization(
    organizationId,
    normalizedRepositoryIds
  );

  if (repositories.length !== normalizedRepositoryIds.length) {
    throw new BadRequestError('All repositories must be active repositories in this organization');
  }

  await BoardRepositoryAccess.replaceRepositoriesForBoard({
    boardId,
    repositoryIds: normalizedRepositoryIds,
  });

  return {
    repositories: await BoardRepositoryAccess.listRepositoriesForBoard(boardId),
  };
}

export async function getOrganizationBoardRepositoryAccess({
  organizationId,
  sessionUserId,
}: {
  organizationId: number;
  sessionUserId: number;
}): Promise<BoardRepositoryAccessMatrixResponse> {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationOwner(organizationId, sessionUserId);

  const [boards, repositories, links] = await Promise.all([
    Board.listAllInOrganization(organizationId),
    Repositories.listForOrganization(organizationId),
    BoardRepositoryAccess.listLinksForOrganization(organizationId),
  ]);

  return {
    boards,
    repositories,
    links,
  };
}
