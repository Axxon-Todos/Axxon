// Provides the organization project creation form for architecture workspaces.
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import { createProject } from '@/lib/api/projects/createProject';

export default function CreateProjectForm({ organizationId, onClose }: { organizationId: string; onClose: (projectId?: number) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => createProject(organizationId, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects', organizationId] });
      onClose(project.id);
    },
  });

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (name.trim()) mutation.mutate(); }}>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="project-name">Project name</label>
        <input id="project-name" className="app-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Payments Platform" autoFocus />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="project-description">Description</label>
        <textarea id="project-description" className="app-input min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are we designing?" />
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create project'}</Button>
      </div>
      {mutation.isError ? <p className="text-sm app-error-text">{mutation.error.message}</p> : null}
    </form>
  );
}
