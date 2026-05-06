// Rolls back the seeded development workspace data using the shared Postgres connection env helpers.
import knex from "knex";
import { getPostgresConnectionConfig } from "../../env/connectionConfig";

// Create the rollback connection from the centralized runtime Postgres env parser.
export async function rollbackSeed() {
  const db = knex({
    client: "pg",
    connection: getPostgresConnectionConfig(),
  });

  try {
    await db('todo_labels').del();
    await db('todos').del();
    await db('labels').del();
    await db('categories').del();
    await db('board_members').del();
    await db('boards').del();
    await db('users').del();

    console.log("Rollback complete.");
  } catch (error) {
    console.error("Rollback failed:", error);
  } finally {
    await db.destroy();
  }
}
