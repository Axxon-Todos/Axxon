// Allows collaboration threads to remain as historical records after their graph anchors are deleted.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Removes the obsolete anchor check while retaining SET NULL foreign-key history behavior.
  await knex.raw(`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      FOR constraint_name IN
        SELECT pg_constraint.conname
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        WHERE pg_class.relname = 'architecture_comment_threads'
          AND pg_get_constraintdef(pg_constraint.oid) LIKE '%component_id IS NOT NULL%'
          AND pg_get_constraintdef(pg_constraint.oid) LIKE '%relationship_id IS NOT NULL%'
      LOOP
        EXECUTE format('ALTER TABLE architecture_comment_threads DROP CONSTRAINT %I', constraint_name);
      END LOOP;
    END $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Restores the old check only when no historical thread would be invalidated.
  const orphanedThreads = await knex('architecture_comment_threads').whereNull('component_id').whereNull('relationship_id').first();
  if (orphanedThreads) throw new Error('Migration 035 cannot be rolled back safely: historical threads no longer have a graph anchor.');
  await knex.raw("ALTER TABLE architecture_comment_threads ADD CONSTRAINT architecture_comment_threads_anchor_check CHECK ((component_id IS NOT NULL) OR (relationship_id IS NOT NULL))");
}
