// app/api/board/[boardId]/categories/reorder/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PATCH_reorder } from '@/lib/controllers/categories/categoryControllers';

// Helper to extract boardId
function getBoardId(req: NextRequest) {
  const parts = new URL(req.url).pathname.split('/');
  // ['', 'api', 'board', boardId, 'categories', 'reorder']
  return parts[3];
}

export async function PATCH(req: NextRequest) {
  const boardId = getBoardId(req);
  if (!boardId) {
    return NextResponse.json({ error: 'Missing boardId' }, { status: 400 });
  }
  return PATCH_reorder(req, { boardId });
}
