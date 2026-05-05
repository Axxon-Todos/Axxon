import { Board } from '@/lib/models/board';
import { BoardMembers } from '@/lib/models/boardMembers';
import { ChatThreads } from '@/lib/models/chatThreads';
import { OrganizationMembers } from '@/lib/models/organizationMembers';
import { Organizations } from '@/lib/models/organizations';
import { PlanningSessions } from '@/lib/models/planningSessions';
import {
  ForbiddenError,
  NotFoundError,
} from '@/lib/utils/apiErrors';

//auth utils for session security 

export function requireSameUser(authenticatedUserId: number, requestedUserId: number) {
  if (authenticatedUserId !== requestedUserId) {
    throw new ForbiddenError('You do not have access to this user resource');
  }
}

export async function requireOrganizationMember(
  organizationId: number,
  userId: number
) {
  const organization = await Organizations.getById(organizationId);

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  const isMember = await OrganizationMembers.isMember(organizationId, userId);

  if (!isMember) {
    throw new ForbiddenError('You do not have access to this organization');
  }

  return organization;
}

export async function requireOrganizationOwner(
  organizationId: number,
  userId: number
) {
  const organization = await requireOrganizationMember(organizationId, userId);
  const role = await OrganizationMembers.getRole(organizationId, userId);

  if (role !== 'owner') {
    throw new ForbiddenError('Only organization owners can perform this action');
  }

  return organization;
}

export async function requireBoardMember(boardId: number, userId: number) {
  const board = await Board.getBoardById(boardId);

  if (!board) {
    throw new NotFoundError('Board not found');
  }

  await requireOrganizationMember(board.organization_id, userId);

  const isMember = await BoardMembers.isMember({ board_id: boardId, user_id: userId });

  if (!isMember) {
    throw new ForbiddenError('You do not have access to this board');
  }

  return board;
}

export async function requireBoardCreator(boardId: number, userId: number) {
  const board = await Board.getBoardById(boardId);

  if (!board) {
    throw new NotFoundError('Board not found');
  }

  await requireOrganizationMember(board.organization_id, userId);

  if (board.created_by !== userId) {
    throw new ForbiddenError('Only the board creator can perform this action');
  }

  return board;
}

export async function requireBoardInOrganization(
  organizationId: number,
  boardId: number,
  userId: number
) {
  const board = await requireBoardMember(boardId, userId);

  if (board.organization_id !== organizationId) {
    throw new NotFoundError('Board not found');
  }

  return board;
}

export async function requireBoardCreatorInOrganization(
  organizationId: number,
  boardId: number,
  userId: number
) {
  const board = await requireBoardCreator(boardId, userId);

  if (board.organization_id !== organizationId) {
    throw new NotFoundError('Board not found');
  }

  return board;
}

export async function requireOrganizationAiThreadCreator(
  organizationId: number,
  threadId: number,
  userId: number
) {
  await requireOrganizationMember(organizationId, userId);
  const thread = await ChatThreads.getThreadById(threadId);

  if (!thread || thread.organization_id !== organizationId) {
    throw new NotFoundError('Chat thread not found');
  }

  if (thread.created_by !== userId) {
    throw new ForbiddenError('You do not have access to this chat thread');
  }

  return thread;
}

export async function requirePlanningSessionCreator(
  organizationId: number,
  boardId: number,
  sessionId: number,
  userId: number
) {
  await requireBoardInOrganization(organizationId, boardId, userId);
  const session = await PlanningSessions.getSessionById(sessionId);

  if (!session || session.organization_id !== organizationId || session.board_id !== boardId) {
    throw new NotFoundError('Planning session not found');
  }

  if (session.created_by !== userId) {
    throw new ForbiddenError('You do not have access to this planning session');
  }

  return session;
}
