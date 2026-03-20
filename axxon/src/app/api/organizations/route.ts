import { NextRequest, NextResponse } from 'next/server';
import {
  createOrganization,
  listOrganizationsForUser,
} from '@/lib/controllers/organizations/organizationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody } from '@/lib/utils/apiRoute';

type CreateOrganizationPayload = {
  name: string;
  description?: string;
  color?: string;
};

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const organizations = await listOrganizationsForUser(session.userId);

    return NextResponse.json(organizations, { status: 200 });
  } catch (error) {
    return handleApiError(
      error,
      '[LIST_ORGANIZATIONS_ERROR]',
      'Failed to list organizations'
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const data = await parseJsonBody<CreateOrganizationPayload>(req);
    const organization = await createOrganization({
      sessionUserId: session.userId,
      data: {
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    return handleApiError(
      error,
      '[CREATE_ORGANIZATION_ERROR]',
      'Failed to create organization'
    );
  }
}
