import { Board } from '@/lib/models/board';
import { BoardMembers } from '@/lib/models/boardMembers';
import { OrganizationMembers } from '@/lib/models/organizationMembers';
import { Organizations } from '@/lib/models/organizations';
import type {
  OrganizationCreation,
  OrganizationUpdate,
} from '@/lib/types/organizationTypes';
import { BadRequestError, NotFoundError } from '@/lib/utils/apiErrors';
import {
  requireOrganizationMember,
  requireOrganizationOwner,
} from '@/lib/utils/authorization';

type CreateOrganizationInput = {
  sessionUserId: number;
  data: Omit<OrganizationCreation, 'created_by'>;
};

type OrganizationAccessInput = {
  organizationId: number;
  sessionUserId: number;
};

type CreateOrganizationBoardInput = {
  organizationId: number;
  sessionUserId: number;
  data: {
    name: string;
    color?: string;
  };
};

type UpdateOrganizationInput = {
  organizationId: number;
  sessionUserId: number;
  data: OrganizationUpdate;
};

function normalizeRequiredName(value: string | undefined, label: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new BadRequestError(`${label} is required`);
  }

  return normalizedValue;
}

function normalizeOrganizationUpdate(
  data: OrganizationUpdate
): OrganizationUpdate {
  const updateData: OrganizationUpdate = {};

  if ('name' in data) {
    updateData.name = normalizeRequiredName(data.name, 'Organization name');
  }

  if ('description' in data) {
    updateData.description = data.description?.trim() || null;
  }

  if ('color' in data) {
    updateData.color = data.color?.trim() || null;
  }

  return updateData;
}

export async function createOrganization({
  sessionUserId,
  data,
}: CreateOrganizationInput) {
  const name = normalizeRequiredName(data.name, 'Organization name');

  return Organizations.createOrganization({
    created_by: sessionUserId,
    name,
    description: data.description?.trim() || null,
    color: data.color?.trim() || null,
  });
}

export async function listOrganizationsForUser(sessionUserId: number) {
  return Organizations.listForUser(sessionUserId);
}

export async function getOrganization({
  organizationId,
  sessionUserId,
}: OrganizationAccessInput) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationMember(organizationId, sessionUserId);
  const organization = await Organizations.getSummaryById(organizationId, sessionUserId);

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization;
}

export async function updateOrganization({
  organizationId,
  sessionUserId,
  data,
}: UpdateOrganizationInput) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationOwner(organizationId, sessionUserId);
  await Organizations.updateOrganization(
    organizationId,
    normalizeOrganizationUpdate(data)
  );

  return getOrganization({ organizationId, sessionUserId });
}

export async function getOrganizationMembers({
  organizationId,
  sessionUserId,
}: OrganizationAccessInput) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationMember(organizationId, sessionUserId);
  return OrganizationMembers.listMembersForOrganization(organizationId);
}

export async function listBoardsForOrganization({
  organizationId,
  sessionUserId,
}: OrganizationAccessInput) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationMember(organizationId, sessionUserId);
  return BoardMembers.listBoardsForOrganization({
    organization_id: organizationId,
    user_id: sessionUserId,
  });
}

export async function createOrganizationBoard({
  organizationId,
  sessionUserId,
  data,
}: CreateOrganizationBoardInput) {
  if (!Number.isFinite(organizationId)) {
    throw new BadRequestError('Invalid organization id');
  }

  await requireOrganizationMember(organizationId, sessionUserId);

  return Board.createBoard({
    organization_id: organizationId,
    created_by: sessionUserId,
    name: normalizeRequiredName(data.name, 'Board name'),
    color: data.color?.trim() || '#2563eb',
    member_emails: [],
  });
}
