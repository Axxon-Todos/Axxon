// Verifies collaboration mention parsing used to trigger scoped architecture-agent runs.
import { describe, expect, it } from 'vitest';
import { extractArchitectureMentions } from '@/lib/agents/architecture/collaborationService';

describe('architecture collaboration mentions', () => {
  it('extracts Axxon and human handles from comment text', () => {
    expect(extractArchitectureMentions('Please review this, @Axxon, with @sam.engineer')).toEqual(['Axxon', 'sam.engineer']);
  });

  it('does not treat email-like text as a mention', () => {
    expect(extractArchitectureMentions('Contact team@example.com before review')).toEqual([]);
  });
});
