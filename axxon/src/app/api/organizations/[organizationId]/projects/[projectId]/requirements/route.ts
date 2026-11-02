// Exposes project architecture requirements for traceable discovery and review context.
import { NextRequest, NextResponse } from 'next/server';
import { ArchitectureRequirements } from '@/lib/models/architectureRequirements';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import { parseJsonBody, type RouteContext } from '@/lib/utils/apiRoute';
import { requireOrganizationProjectMember } from '@/lib/utils/organizationProjectRoute';

type Params = { organizationId: string; projectId: string };

export async function GET(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    return NextResponse.json(await ArchitectureRequirements.list(params.projectId));
  } catch (error) {
    return handleApiError(error, '[LIST_ARCHITECTURE_REQUIREMENTS_ERROR]', 'Failed to list architecture requirements');
  }
}

export async function POST(request: NextRequest, context: RouteContext<Params>) {
  try {
    const session = await requireSession(request);
    const params = await requireOrganizationProjectMember(context, session.userId);
    const body = await parseJsonBody<{ key?: string; title?: string; statement?: string; category?: string; priority?: string; status?: string; source?: string; rationale?: string | null; blocking?: boolean }>(request);
    if (!body.key?.trim() || !body.title?.trim() || !body.statement?.trim()) throw new Error('Requirement key, title, and statement are required');
    const requirement = await ArchitectureRequirements.upsert({ project_id: params.projectId, key: body.key.trim(), title: body.title.trim(), statement: body.statement.trim(), category: body.category || 'general', priority: body.priority || 'medium', status: body.status || 'confirmed', source: body.source || 'user', rationale: body.rationale || null, answer_json: {}, blocking: Boolean(body.blocking), created_by: session.userId });
    return NextResponse.json(requirement, { status: 201 });
  } catch (error) {
    return handleApiError(error, '[CREATE_ARCHITECTURE_REQUIREMENT_ERROR]', 'Failed to create architecture requirement');
  }
}
