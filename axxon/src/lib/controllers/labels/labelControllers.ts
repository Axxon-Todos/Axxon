import { NextRequest, NextResponse } from 'next/server';
import { Labels } from '@/lib/models/labels';
import type { CreateLabelData, UpdateLabelData } from '@/lib/types/labelTypes';
import { publishBoardUpdate } from '@/lib/wsServer';

// Create Label (POST /board/[boardId]/labels)
export async function POST(req: NextRequest, params: { boardId: string } ) {
    const board_id = Number(params.boardId);
    const body = await req.json();

    const data: CreateLabelData = { ...body, board_id };
    const label = await Labels.createLabel(data);

    // Publish to WebSocket for real-time sync
    await publishBoardUpdate(String(board_id), {
      type: 'label:created',
      payload: label
    });

    return label;
}

// List Labels in Board (GET /board/[boardId]/labels)
export async function GET(_req: NextRequest, params: { boardId: string } ) {
    const board_id = Number(params.boardId);
    return await Labels.listAllLabelsInBoard({ board_id });
}

// Update Label (PATCH /board/[boardId]/labels/[labelId])
export async function PATCH(req: NextRequest, params: { boardId: string; labelId: string } ) {
  try {
    const id = Number(params.labelId);
    const board_id = Number(params.boardId);
    const body = await req.json();

    const data: UpdateLabelData = { ...body, id, board_id };
    const label = await Labels.updateLabel(data);

    // Publish to WebSocket for real-time sync
    await publishBoardUpdate(String(board_id), {
      type: 'label:updated',
      payload: label
    });

    return NextResponse.json(label, { status: 200 });
  } catch (error) {
    console.error('[UPDATE_LABEL_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

// Delete Label (DELETE /board/[boardId]/labels/[labelId])
export async function DELETE(_req: NextRequest, params: { boardId: string; labelId: string } ) {
  try {
    const id = Number(params.labelId);
    const board_id = Number(params.boardId);
    const deleted = await Labels.deleteLabel({ id });

    // Publish to WebSocket for real-time sync
    await publishBoardUpdate(String(board_id), {
      type: 'label:deleted',
      payload: { id }
    });

    return NextResponse.json({ deleted }, { status: 200 });
  } catch (error) {
    console.error('[DELETE_LABEL_ERROR]', error);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}

// Get Label by ID (GET /board/[boardId]/labels/[labelId])
export async function getLabelByIdController(_req: NextRequest, params: { boardId: string; labelId: string } ) {
  try {
    const id = Number(params.labelId);
    const label = await Labels.getLabelById({ id });

    return NextResponse.json(label, { status: 200 });
  } catch (error) {
    console.error('[GET_LABEL_BY_ID_ERROR]', error);
    return NextResponse.json({ error: 'Failed to retrieve label' }, { status: 500 });
  }
}
