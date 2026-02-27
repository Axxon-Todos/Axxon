import { NextRequest, NextResponse } from 'next/server';
import { POST as createLabel, GET as listLabels } from '@/lib/controllers/labels/labelControllers';

interface RouteParams {
  boardId: string;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<RouteParams> } // note the Promise here
) {
  try {
    const { boardId } = await context.params; // await the params object
    if (!boardId) throw new Error('Missing boardId');

    const labels = await listLabels(req, { boardId });
    return NextResponse.json(labels, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<RouteParams> } // again, async
) {
  try {
    const { boardId } = await context.params;
    if (!boardId) throw new Error('Missing boardId');

    const newLabel = await createLabel(req, { boardId });
    return NextResponse.json(newLabel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
