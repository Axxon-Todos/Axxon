// Extracts, verifies, and parses GitHub webhook requests before they reach webhook handlers.
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestError,
  UnauthorizedError,
} from '@/lib/utils/apiErrors';
import { getGitHubWebhookSecret } from '@/lib/github/env';

type ExtractedGitHubWebhookHeaders = {
  deliveryId: string;
  eventName: string;
  signature256: string;
  headersJson: Record<string, string>;
};

function asBuffer(value: string) {
  return Buffer.from(value, 'utf8');
}

export function extractGitHubWebhookHeaders(
  headers: Headers
): ExtractedGitHubWebhookHeaders {
  const deliveryId = headers.get('x-github-delivery');
  const eventName = headers.get('x-github-event');
  const signature256 = headers.get('x-hub-signature-256');

  if (!deliveryId || !eventName) {
    throw new BadRequestError(
      'Missing required GitHub webhook headers'
    );
  }

  if (!signature256) {
    throw new UnauthorizedError('Missing GitHub webhook signature');
  }

  const headersJson: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersJson[key] = value;
  });

  return {
    deliveryId,
    eventName,
    signature256,
    headersJson,
  };
}

export function verifyGitHubWebhookSignature({
  rawBody,
  signature256,
}: {
  rawBody: string;
  signature256: string;
}) {
  const expectedSignature = `sha256=${createHmac(
    'sha256',
    getGitHubWebhookSecret()
  )
    .update(rawBody)
    .digest('hex')}`;

  const providedBuffer = asBuffer(signature256);
  const expectedBuffer = asBuffer(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedError('Invalid GitHub webhook signature');
  }
}

export function parseGitHubWebhookPayload(rawBody: string) {
  try {
    const payload = JSON.parse(rawBody) as unknown;

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new BadRequestError('GitHub webhook payload must be a JSON object');
    }

    return payload as Record<string, unknown>;
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }

    throw new BadRequestError('Invalid GitHub webhook payload');
  }
}
