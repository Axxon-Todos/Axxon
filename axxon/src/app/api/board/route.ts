import { NextRequest, NextResponse } from 'next/server';
import { createBoardController} from '@/lib/controllers/board/create';
import { requireSession } from '@/lib/utils/auth';
import { handleApiError } from '@/lib/utils/apiErrors';

//route passes down NextRequest for the controller to use
export async function POST(req: NextRequest) {
  try{ 
    const session = await requireSession(req);

    const data = await req.json();
    const board = await createBoardController({ userId: session.userId, data});

    return NextResponse.json(board, { status: 201});
  } catch (error) {
    return handleApiError(error, '[CREATE_BOARD_ERROR]', 'Failed to create board');
  }
};
