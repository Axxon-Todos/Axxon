// Explains that agent work is board-scoped while the frontend agent workspace is rebuilt on the unified API.
import Link from 'next/link';

type OrganizationAiPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function OrganizationAiPage({
  params,
}: OrganizationAiPageProps) {
  const { organizationId } = await params;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="app-kicker">Agent Control</p>
      <h1 className="mt-3 text-3xl font-semibold">Agent runs are board-scoped</h1>
      <p className="mt-4 app-text-muted">
        Create and review agent work from a board. The unified backend now records every lifecycle transition and dispatch request.
      </p>
      <Link className="mt-8 inline-flex app-button-primary" href={`/dashboard/orgs/${organizationId}`}>
        Open organization boards
      </Link>
    </main>
  );
}
