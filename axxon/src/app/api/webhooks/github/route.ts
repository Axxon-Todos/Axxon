// Accepts GitHub App webhooks and hands them off to the org-scoped integration processor.
import { NextRequest, NextResponse } from 'next/server';
import { processGitHubWebhook } from '@/lib/controllers/integrations/github/githubIntegrationControllers';
import { handleApiError } from '@/lib/utils/apiErrors';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const result = await processGitHubWebhook({
      rawBody,
      headers: req.headers,
    });

    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        processed: result.processed,
      },
      {
        status: result.duplicate ? 200 : 202,
      }
    );
  } catch (error) {
    return handleApiError(
      error,
      '[GITHUB_WEBHOOK_ERROR]',
      'Failed to process the GitHub webhook'
    );
  }
}
