// Adds structured option and answer fields to planning clarification questions for guided card-based replies.
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('planning_session_questions', (table) => {
    table.jsonb('options_json').notNullable().defaultTo('[]');
    table.string('selected_option_key').nullable();
    table.text('answer_note').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('planning_session_questions', (table) => {
    table.dropColumn('answer_note');
    table.dropColumn('selected_option_key');
    table.dropColumn('options_json');
  });
}
