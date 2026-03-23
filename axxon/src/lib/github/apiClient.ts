// Centralizes authenticated JSON requests to the GitHub REST API and normalizes API errors.
import { getGitHubApiBaseUrl } from '@/lib/github/env';

export class GitHubApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

type GitHubJsonRequestOptions = {
  method?: string;
  token?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
};

async function parseGitHubError(res: Response) {
  try {
    const data = (await res.json()) as { message?: string };
    return data.message ?? `GitHub request failed with status ${res.status}`;
  } catch {
    return `GitHub request failed with status ${res.status}`;
  }
}

export async function githubJsonRequest<T>(
  path: string,
  options: GitHubJsonRequestOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'Axxon-GitHub-App');

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const res = await fetch(`${getGitHubApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ?? null,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new GitHubApiError(res.status, await parseGitHubError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
