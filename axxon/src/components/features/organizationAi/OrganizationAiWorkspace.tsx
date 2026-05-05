// Hosts the shared org AI workspace and lets users switch between assistant and planning modes.
'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bot, FolderKanban, Sparkles } from 'lucide-react';

import OrganizationAiAssistantPanel from '@/components/features/organizationAi/OrganizationAiAssistantPanel';
import OrganizationAiPlanningPanel from '@/components/features/organizationAi/OrganizationAiPlanningPanel';
import Badge from '@/components/ui/Badge';
import PageHero from '@/components/ui/PageHero';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Surface from '@/components/ui/Surface';
import { fetchOrganization } from '@/lib/api/organizations/getOrganization';
import type { AiRuntimeSummary } from '@/lib/types/aiTypes';
import { resolveAccentColor } from '@/lib/utils/brandColors';
import { buildOrganizationPath } from '@/lib/utils/routes';

type WorkspaceMode = 'assistant' | 'planning';

function parseWorkspaceMode(searchParams: Pick<URLSearchParams, 'get'>): WorkspaceMode {
  return searchParams.get('mode') === 'planning' ? 'planning' : 'assistant';
}

export default function OrganizationAiWorkspace({
  organizationId,
  runtime,
}: {
  organizationId: string;
  runtime: AiRuntimeSummary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = parseWorkspaceMode(searchParams);

  const { data: organization, isLoading: isOrganizationLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => fetchOrganization(organizationId),
  });

  const setMode = (nextMode: WorkspaceMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', nextMode);

    if (nextMode === 'assistant') {
      params.delete('boardId');
      params.delete('sessionId');
    } else {
      params.delete('threadId');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (isOrganizationLoading || !organization) {
    return (
      <div className="app-page">
        <Surface variant="strong" className="rounded-[2rem] p-8">
          <p className="app-kicker">Organization AI</p>
          <h1 className="mt-3 text-3xl font-semibold">Loading AI workspace...</h1>
        </Surface>
      </div>
    );
  }

  const accentColor = resolveAccentColor(organization.color);

  return (
    <div className="app-page">
      <PageHero
        kicker="Organization AI"
        title={`${organization.name} AI workspace`}
        description="Use the assistant for general-purpose org AI conversations, or switch into planning mode for board-bound clarification loops and structured implementation plans."
        accentColor={accentColor}
        actions={
          <Link href={buildOrganizationPath(organizationId)} className="app-button">
            <ArrowLeft className="h-4 w-4" />
            Back to Organization
          </Link>
        }
        badges={
          <>
            <Badge>
              <Sparkles className="h-3.5 w-3.5" />
              {runtime.providerLabel}
            </Badge>
            <Badge>
              <Bot className="h-3.5 w-3.5" />
              {runtime.model}
            </Badge>
            <Badge>{runtime.stage}</Badge>
          </>
        }
      />

      <Surface variant="strong" className="rounded-[2rem] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Mode</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {mode === 'assistant' ? 'General assistant' : 'Planning mode'}
            </h2>
            <p className="mt-2 text-sm leading-6 app-text-muted">
              {mode === 'assistant'
                ? 'Open-ended org AI chat with persisted threads and streaming responses.'
                : 'Board-bound planning sessions with readiness tracking, clarification questions, and structured plans.'}
            </p>
          </div>

          <SegmentedControl<WorkspaceMode>
            value={mode}
            onChange={setMode}
            ariaLabel="Organization AI mode"
            options={[
              {
                value: 'assistant',
                label: 'Assistant',
                icon: <Bot className="h-4 w-4" />,
              },
              {
                value: 'planning',
                label: 'Planning',
                icon: <FolderKanban className="h-4 w-4" />,
              },
            ]}
            className="w-full sm:w-auto"
          />
        </div>
      </Surface>

      {mode === 'assistant' ? (
        <OrganizationAiAssistantPanel organizationId={organizationId} runtime={runtime} />
      ) : (
        <OrganizationAiPlanningPanel organizationId={organizationId} runtime={runtime} />
      )}
    </div>
  );
}
