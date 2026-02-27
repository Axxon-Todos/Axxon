import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/utils/auth';
import { handleApiError } from '@/lib/utils/apiErrors';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    return NextResponse.json({ userId: session.userId });
  } catch (error) {
    return handleApiError(error, '[GET_CURRENT_USER_ERROR]', 'Failed to resolve current user');
  }
}
