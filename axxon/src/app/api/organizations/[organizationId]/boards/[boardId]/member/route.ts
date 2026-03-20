import { NextRequest, NextResponse } from 'next/server';
import {
  addBoardMembersByEmail,
  getBoardMembers,
} from '@/lib/controllers/boardMembers/boardMemberControllers';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  type RouteContext,
} from '@/lib/utils/apiRoute';
import { requireOrganizationBoardMember } from '@/lib/utils/organizationBoardRoute';

type BoardMemberRouteParams = {
  organizationId: string;
  boardId: string;
};

type AddBoardMembersPayload = {
  emails: string[];
};

export async function GET(req: NextRequest, context: RouteContext<BoardMemberRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const members = await getBoardMembers({
      boardId,
      sessionUserId: session.userId,
    });

    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[DISPLAY_BOARD_MEMBERS_ERROR]', 'Failed to display board members');
  }
}

export async function POST(req: NextRequest, context: RouteContext<BoardMemberRouteParams>) {
  try {
    const session = await requireSession(req);
    const { boardId } = await requireOrganizationBoardMember(context, session.userId);
    const data = await parseJsonBody<AddBoardMembersPayload>(req);
    const result = await addBoardMembersByEmail({
      boardId,
      sessionUserId: session.userId,
      data,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, '[ADD_BOARD_MEMBER_BY_EMAIL_ERROR]', 'Failed to add member by email');
  }
}
