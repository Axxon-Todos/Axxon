import knex from '@/lib/db/db';
import type {
  CreateSprintData,
  GetSprintByIdData,
  ListSprintsData,
  SprintBaseData,
  SprintIcon,
  UpdateSprintData,
} from '@/lib/types/sprintTypes';
import { SPRINT_ICON_OPTIONS } from '@/lib/types/sprintTypes';

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error('Sprint name is required');
  }

  return trimmed;
}

function normalizeDateValue(value: string, label: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Sprint ${label} is invalid`);
  }

  return value;
}

function validateDateRange(startDate: string, endDate: string) {
  const normalizedStartDate = normalizeDateValue(startDate, 'start date');
  const normalizedEndDate = normalizeDateValue(endDate, 'end date');

  if (new Date(normalizedEndDate).getTime() < new Date(normalizedStartDate).getTime()) {
    throw new Error('Sprint end date must be on or after the start date');
  }

  return {
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
  };
}

function normalizeIcon(icon?: SprintIcon | null) {
  if (!icon) {
    return null;
  }

  if (!SPRINT_ICON_OPTIONS.includes(icon)) {
    throw new Error('Sprint icon is invalid');
  }

  return icon;
}

function normalizeArchivedAt(value?: string | null) {
  if (value == null) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Sprint archived date is invalid');
  }

  return parsed.toISOString();
}

export class Sprints {
  static createSprint = async (data: CreateSprintData): Promise<SprintBaseData> => {
    const name = normalizeRequiredName(data.name);
    const { start_date, end_date } = validateDateRange(data.start_date, data.end_date);

    const [sprint] = await knex('sprints')
      .insert({
        board_id: data.board_id,
        name,
        description: normalizeOptionalText(data.description),
        start_date,
        end_date,
        color: normalizeOptionalText(data.color),
        icon: normalizeIcon(data.icon),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })
      .returning('*');

    return sprint;
  };

  static updateSprint = async (data: UpdateSprintData): Promise<SprintBaseData | null> => {
    const { id, board_id, ...updateData } = data;

    return await knex.transaction(async (trx) => {
      const currentSprint = await trx('sprints').where({ id, board_id }).first();

      if (!currentSprint) {
        return null;
      }

      const nextName = Object.prototype.hasOwnProperty.call(updateData, 'name')
        ? normalizeRequiredName(updateData.name ?? '')
        : currentSprint.name;

      const nextDescription = Object.prototype.hasOwnProperty.call(updateData, 'description')
        ? normalizeOptionalText(updateData.description ?? null)
        : currentSprint.description;

      const nextColor = Object.prototype.hasOwnProperty.call(updateData, 'color')
        ? normalizeOptionalText(updateData.color ?? null)
        : currentSprint.color;

      const nextIcon = Object.prototype.hasOwnProperty.call(updateData, 'icon')
        ? normalizeIcon(updateData.icon ?? null)
        : currentSprint.icon;

      const nextArchivedAt = Object.prototype.hasOwnProperty.call(updateData, 'archived_at')
        ? normalizeArchivedAt(updateData.archived_at ?? null)
        : currentSprint.archived_at;

      const { start_date, end_date } = validateDateRange(
        updateData.start_date ?? currentSprint.start_date,
        updateData.end_date ?? currentSprint.end_date
      );

      const [sprint] = await trx('sprints')
        .where({ id, board_id })
        .update({
          name: nextName,
          description: nextDescription,
          start_date,
          end_date,
          color: nextColor,
          icon: nextIcon,
          archived_at: nextArchivedAt,
          updated_at: knex.fn.now(),
        })
        .returning('*');

      return sprint ?? null;
    });
  };

  static listSprintsInBoard = async (data: ListSprintsData): Promise<SprintBaseData[]> => {
    return await knex('sprints')
      .where({ board_id: data.board_id })
      .orderBy('archived_at', 'asc')
      .orderBy('start_date', 'asc');
  };

  static getSprintById = async (data: GetSprintByIdData): Promise<SprintBaseData | null> => {
    return (await knex('sprints').where({ id: data.id, board_id: data.board_id }).first()) ?? null;
  };
}
