// Renders a reusable architecture discussion panel that can be mounted beside any project canvas.
'use client';

import { useState } from 'react';
import { MessageCircle, Send, Check, RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Surface from '@/components/ui/Surface';
import { addArchitectureComment, createArchitectureThread, setArchitectureThreadResolved } from '@/lib/api/projects/collaboration';
import type { ArchitectureCommentThread } from '@/lib/types/architectureCollaborationTypes';
import { cn } from '@/lib/utils/cn';

type Props = { organizationId: string; projectId: string; componentId?: string | null; relationshipId?: string | null; revisionId?: number | null; threads: ArchitectureCommentThread[]; className?: string };

export function ArchitectureCollaborationPanel({ organizationId, projectId, componentId, relationshipId, revisionId, threads, className }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['architecture-threads', organizationId, projectId] });
  const createMutation = useMutation({ mutationFn: () => createArchitectureThread(organizationId, projectId, { body: draft, componentId: componentId || undefined, relationshipId: relationshipId || undefined, revisionId: revisionId || undefined }), onSuccess: () => { setDraft(''); invalidate(); } });
  const replyMutation = useMutation({ mutationFn: ({ threadId, body }: { threadId: number; body: string }) => addArchitectureComment(organizationId, projectId, threadId, body), onSuccess: (_, variables) => { setReplyDrafts((current) => ({ ...current, [variables.threadId]: '' })); invalidate(); } });
  const resolveMutation = useMutation({ mutationFn: ({ threadId, resolved }: { threadId: number; resolved: boolean }) => setArchitectureThreadResolved(organizationId, projectId, threadId, resolved), onSuccess: invalidate });
  const scoped = Boolean(componentId || relationshipId);
  const visibleThreads = threads.filter((thread) => !scoped || ((!componentId || thread.component_id === componentId) && (!relationshipId || thread.relationship_id === relationshipId)));

  return <Surface variant="strong" className={cn('flex min-h-0 flex-col rounded-2xl p-4', className)}>
    <div className="flex items-center justify-between gap-3"><div><p className="app-kicker">Collaboration</p><h2 className="mt-1 flex items-center gap-2 text-base font-semibold"><MessageCircle className="h-4 w-4" /> Architecture discussion</h2></div><Badge>{visibleThreads.filter((thread) => thread.status === 'open').length} open</Badge></div>
    <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
      {visibleThreads.length === 0 ? <p className="py-6 text-sm leading-6 app-text-muted">Start a discussion on this architecture element. Mention <span className="font-medium app-text">@Axxon</span> to request a scoped agent review.</p> : visibleThreads.map((thread) => <div key={thread.id} className={cn('rounded-xl border p-3', thread.status === 'resolved' ? 'border-[var(--app-border)] opacity-70' : 'border-[var(--app-border-strong)]')}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs app-text-muted">Thread #{thread.id}</span><button type="button" className="rounded-md p-1 app-text-muted hover:text-[var(--app-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-foreground)]" onClick={() => resolveMutation.mutate({ threadId: thread.id, resolved: thread.status !== 'resolved' })} aria-label={thread.status === 'resolved' ? 'Reopen thread' : 'Resolve thread'}>{thread.status === 'resolved' ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}</button></div>
        <div className="mt-3 space-y-2">{(thread.comments || []).map((comment) => <div key={comment.id} className="rounded-lg bg-[var(--app-panel-soft)] p-2.5 text-sm"><p className="whitespace-pre-wrap leading-5">{comment.body}</p><p className="mt-1 text-[11px] app-text-muted">{comment.author_type === 'agent' ? 'Axxon' : `User ${comment.author_id}`}</p></div>)}</div>
        {selectedThreadId === thread.id ? <div className="mt-3 flex gap-2"><input aria-label={`Reply to thread ${thread.id}`} value={replyDrafts[thread.id] || ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} className="app-input min-w-0 flex-1 rounded-lg px-2.5 py-2 text-sm" placeholder="Reply or mention @Axxon" /><Button size="sm" onClick={() => replyMutation.mutate({ threadId: thread.id, body: replyDrafts[thread.id] || '' })} disabled={!replyDrafts[thread.id]?.trim() || replyMutation.isPending} aria-label="Send reply"><Send className="h-4 w-4" /></Button></div> : <button type="button" className="mt-3 text-xs font-medium app-text-muted hover:text-[var(--app-foreground)]" onClick={() => setSelectedThreadId(thread.id)}>Reply</button>}
      </div>)}
    </div>
    <div className="mt-4 border-t border-[var(--app-border)] pt-3"><textarea aria-label="New architecture comment" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="app-input w-full resize-none rounded-xl p-3 text-sm" placeholder="Comment on this architecture element..." /><Button className="mt-2 w-full" onClick={() => createMutation.mutate()} disabled={!draft.trim() || createMutation.isPending}><Send className="h-4 w-4" /> Add comment</Button></div>
  </Surface>;
}
