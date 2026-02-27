'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTodo, NewTodoInput } from '@/lib/api/todos/createTodo';
import type { FormEvent } from 'react';

interface AddTodoFormProps {
  boardId: number;
  onClose?: () => void;
}

export default function AddTodoForm({ boardId, onClose }: AddTodoFormProps) {
  const queryClient = useQueryClient();

  const { mutate, status, error } = useMutation({
    mutationFn: (data: NewTodoInput) => createTodo(boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', boardId] });
      onClose?.();
    },
  });

  const isLoading = status === 'pending';

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: NewTodoInput = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || undefined,
      due_date: (formData.get('due_date') as string) || undefined,
      assignee_id: formData.get('assignee_id') ? Number(formData.get('assignee_id')) : undefined,
      priority: formData.get('priority') ? Number(formData.get('priority')) : undefined,
      category_id: formData.get('category_id') ? Number(formData.get('category_id')) : undefined,
    };

    mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <input name="title" required placeholder="Ship dashboard polish" className="app-input" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          placeholder="Capture the outcome, next step, or blocker."
          className="app-input min-h-28 resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Due Date</label>
          <input type="date" name="due_date" className="app-input" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <select name="priority" className="app-input" defaultValue="3">
            <option value="1">None</option>
            <option value="2">Low</option>
            <option value="3">Medium</option>
            <option value="4">High</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Assignee ID</label>
          <input type="number" name="assignee_id" placeholder="Optional" className="app-input" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Category ID</label>
          <input type="number" name="category_id" placeholder="Optional" className="app-input" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="glass-button">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Creating...' : 'Create Todo'}
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{(error as Error).message}</p>}
    </form>
  );
}
