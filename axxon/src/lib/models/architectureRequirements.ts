// Persists project requirements and their links to architecture entities.
import db from '@/lib/db/db';

export type ArchitectureRequirement = {
  id: number;
  project_id: number;
  key: string;
  title: string;
  statement: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  rationale: string | null;
  answer_json: Record<string, unknown>;
  blocking: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export class ArchitectureRequirements {
  // Lists requirements in priority order for agent context and project APIs.
  static async list(projectId: number) {
    return db('architecture_requirements').where({ project_id: projectId }).orderByRaw(`CASE priority WHEN 'blocking' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`).orderBy('id', 'asc') as unknown as Promise<ArchitectureRequirement[]>;
  }

  // Creates or updates one requirement while preserving its stable project-local key.
  static async upsert(input: Omit<ArchitectureRequirement, 'id' | 'created_at' | 'updated_at'>, trx = db) {
    const [row] = await trx('architecture_requirements').insert({ ...input, answer_json: input.answer_json || {} }).onConflict(['project_id', 'key']).merge({ ...input, updated_at: trx.fn.now() }).returning('*');
    return row as ArchitectureRequirement;
  }

  // Links a requirement to an architecture entity without duplicating links.
  static async link(requirementId: number, entityType: string, entityId: string, trx = db) {
    await trx('architecture_requirement_links').insert({ requirement_id: requirementId, entity_type: entityType, entity_id: entityId }).onConflict(['requirement_id', 'entity_type', 'entity_id']).ignore();
  }
}
