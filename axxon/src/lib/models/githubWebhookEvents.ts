// Persists GitHub webhook deliveries so processing stays idempotent and auditable.
import db from '@/lib/db/db';
import type {
  GithubWebhookEventRecord,
  GithubWebhookEventStatus,
} from '@/lib/types/githubIntegrationTypes';

type CreateGithubWebhookEventInput = {
  github_delivery_id: string;
  event_name: string;
  action?: string | null;
  github_installation_id?: string | null;
  github_repository_id?: string | null;
  signature_256?: string | null;
  payload_json: Record<string, unknown>;
  headers_json: Record<string, string>;
};

export class GithubWebhookEvents {
  static async createIfNotExists(data: CreateGithubWebhookEventInput): Promise<{
    event: GithubWebhookEventRecord;
    inserted: boolean;
  }> {
    const [createdEvent] = await db('github_webhook_events')
      .insert({
        ...data,
        action: data.action ?? null,
        github_installation_id: data.github_installation_id ?? null,
        github_repository_id: data.github_repository_id ?? null,
        signature_256: data.signature_256 ?? null,
        received_at: db.fn.now(),
        status: 'received',
      })
      .onConflict(['github_delivery_id'])
      .ignore()
      .returning('*');

    if (createdEvent) {
      return {
        event: createdEvent,
        inserted: true,
      };
    }

    const existingEvent = await db<GithubWebhookEventRecord>('github_webhook_events')
      .where({ github_delivery_id: data.github_delivery_id })
      .first();

    if (!existingEvent) {
      throw new Error('Failed to load persisted webhook event');
    }

    return {
      event: existingEvent,
      inserted: false,
    };
  }

  static async markStatus({
    id,
    status,
    errorMessage,
    incrementRetry = false,
  }: {
    id: number;
    status: GithubWebhookEventStatus;
    errorMessage?: string | null;
    incrementRetry?: boolean;
  }): Promise<void> {
    await db('github_webhook_events')
      .where({ id })
      .update({
        status,
        error_message: errorMessage ?? null,
        processed_at: db.fn.now(),
        retry_count: incrementRetry ? db.raw('retry_count + 1') : db.ref('retry_count'),
      });
  }
}
