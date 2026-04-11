// Streams org-scoped AI chat responses to authenticated organization members.
import { NextRequest, NextResponse } from 'next/server';
import { createOrganizationAiChatStream } from '@/lib/controllers/ai/organizationAiControllers';
import type { AiChatRequest } from '@/lib/types/aiTypes';
import { handleApiError } from '@/lib/utils/apiErrors';
import { requireSession } from '@/lib/utils/auth';
import {
  parseJsonBody,
  parseNumericRouteParam,
  type RouteContext,
} from '@/lib/utils/apiRoute';

type OrganizationAiChatRouteParams = {
  organizationId: string;
};

export async function POST(
  req: NextRequest,
  context: RouteContext<OrganizationAiChatRouteParams>
) {
  try {
    const session = await requireSession(req);
    const { organizationId } = await context.params;
    const data = await parseJsonBody<AiChatRequest>(req);
    const response = await createOrganizationAiChatStream({
      organizationId: parseNumericRouteParam(organizationId, 'organization id'),
      sessionUserId: session.userId,
      data,
    });

    // Disable caching so incremental chat output is forwarded to the browser as it is generated.
    return new NextResponse(response.stream, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Axxon-Ai-Model': response.runtime.model,
        'X-Axxon-Ai-Provider': response.runtime.provider,
      },
    });
  } catch (error) {
    return handleApiError(
      error,
      '[ORGANIZATION_AI_CHAT_ERROR]',
      'Failed to process the AI chat request'
    );
  }
}
