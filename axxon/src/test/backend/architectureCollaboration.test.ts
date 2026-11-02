// Verifies collaboration transactions keep discussion history, audit events, and agent jobs consistent.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createArchitectureThread, addArchitectureComment, resolveArchitectureThread } from '@/lib/agents/architecture/collaborationService';
import { ArchitectureCollaboration } from '@/lib/models/architectureCollaboration';
import { Projects } from '@/lib/models/projects';
import { createOrganizationRecord, createUser } from './factories';
import { db, resetDatabase } from './db';

vi.mock('@/lib/wsServer', () => ({ publishProjectUpdate: vi.fn() }));
import { extractArchitectureMentions } from '@/lib/agents/architecture/collaborationService';

describe('architecture collaboration mentions', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('extracts Axxon and human handles from comment text', () => {
    expect(extractArchitectureMentions('Please review this, @Axxon, with @sam.engineer')).toEqual(['Axxon', 'sam.engineer']);
  });

  it('does not treat email-like text as a mention', () => {
    expect(extractArchitectureMentions('Contact team@example.com before review')).toEqual([]);
  });

  it('commits a thread, comment, audit event, run, and job together', async () => {
    const user = await createUser();
    const organization = await createOrganizationRecord({ createdBy: user.id });
    const project = await Projects.create({ organization_id: organization.id, name: 'Architecture', description: null, created_by: user.id });
    await db('architecture_components').insert({ id: 'component-transaction', project_id: project.id, type: 'service', name: 'API', responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} });

    const thread = await createArchitectureThread({ organizationId: organization.id, projectId: project.id, userId: user.id, body: '@Axxon review this service', componentId: 'component-transaction' });

    expect(thread.agentRun?.id).toBeTypeOf('number');
    expect(await db('architecture_comment_threads').where({ project_id: project.id })).toHaveLength(1);
    expect(await db('architecture_comments').where({ thread_id: thread.id })).toHaveLength(1);
    expect(await db('architecture_collaboration_events').where({ project_id: project.id }).orderBy('id')).toHaveLength(2);
    expect(await db('agent_runs').where({ project_id: project.id })).toHaveLength(1);
    expect(await db('agent_jobs').where({ run_id: thread.agentRun?.id })).toHaveLength(1);
  });

  it('keeps replies and resolution audit events in the same transaction as their mutation', async () => {
    const user = await createUser();
    const organization = await createOrganizationRecord({ createdBy: user.id });
    const project = await Projects.create({ organization_id: organization.id, name: 'Architecture', description: null, created_by: user.id });
    await db('architecture_components').insert({ id: 'component-reply', project_id: project.id, type: 'service', name: 'API', responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} });
    const thread = await createArchitectureThread({ organizationId: organization.id, projectId: project.id, userId: user.id, body: 'Initial note', componentId: 'component-reply' });

    await addArchitectureComment({ organizationId: organization.id, projectId: project.id, threadId: thread.id, userId: user.id, body: 'Follow-up' });
    await resolveArchitectureThread({ organizationId: organization.id, projectId: project.id, threadId: thread.id, userId: user.id, resolved: true });

    expect((await db('architecture_comments').where({ thread_id: thread.id }))).toHaveLength(2);
    expect((await db('architecture_comment_threads').where({ id: thread.id }).first()).status).toBe('resolved');
    expect(await db('architecture_collaboration_events').where({ project_id: project.id }).orderBy('id').pluck('event_type')).toEqual(['thread.created', 'comment.created', 'thread.resolved']);
  });

  it('rolls back discussion rows when audit event creation fails', async () => {
    const user = await createUser();
    const organization = await createOrganizationRecord({ createdBy: user.id });
    const project = await Projects.create({ organization_id: organization.id, name: 'Architecture', description: null, created_by: user.id });
    await db('architecture_components').insert({ id: 'component-rollback', project_id: project.id, type: 'service', name: 'API', responsibilities: [], technologies: [], requirements: [], constraints: [], metadata: {} });
    vi.spyOn(ArchitectureCollaboration, 'appendEvent').mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(createArchitectureThread({ organizationId: organization.id, projectId: project.id, userId: user.id, body: 'Should roll back', componentId: 'component-rollback' })).rejects.toThrow('audit unavailable');
    expect(await db('architecture_comment_threads').where({ project_id: project.id })).toHaveLength(0);
    expect(await db('architecture_comments')).toHaveLength(0);
    expect(await db('architecture_collaboration_events').where({ project_id: project.id })).toHaveLength(0);
  });
});
