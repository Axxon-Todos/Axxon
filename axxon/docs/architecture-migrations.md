# Architecture migration policy

Architecture collaboration, requirements, and review records are durable product history. Migrations 031–033 therefore fail explicitly on rollback instead of deleting user data. Restore from a database backup when a rollback of those migrations is required.

Migration 034 can roll back only when every change-set has a unique `run_id`; it rejects rollback when iteration rows would violate the old unique constraint.

Migration 035 removes the obsolete requirement that every collaboration thread retain a live component or relationship anchor. Its down path checks for orphaned historical threads before restoring that constraint. The `SET NULL` foreign keys intentionally preserve the thread, comments, and events when graph entities are deleted.
