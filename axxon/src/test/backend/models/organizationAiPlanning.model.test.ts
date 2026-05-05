// Verifies board-bound planning session persistence, process-claim helpers, and question tracking helpers.
import { beforeEach, describe, expect, it } from 'vitest';

import db from '@/lib/db/db';
import { PlanningSessionMessages } from '@/lib/models/planningSessionMessages';
import { PlanningSessionQuestions } from '@/lib/models/planningSessionQuestions';
import { PlanningSessions } from '@/lib/models/planningSessions';

import { resetDatabase } from '../db';
import {
  createBoardRecord,
  createPlanningQuestionRecord,
  createPlanningSessionMessageRecord,
  createPlanningSessionRecord,
  createOrganizationRecord,
  createUser,
} from '../factories';

describe('organization AI planning models', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lists only the creator planning sessions for the selected board ordered by most recently updated', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const teammate = await createUser({ email: 'teammate@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
      name: 'Roadmap',
    });

    const firstSession = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      title: 'First planning session',
    });
    const secondSession = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      title: 'Second planning session',
    });

    await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: teammate.id,
      title: 'Private teammate session',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await PlanningSessions.updateSession(firstSession.id, {
      summary: 'Most recently touched',
    });

    const sessions = await PlanningSessions.listSessionsForUser({
      organizationId: organization.id,
      boardId: Number(board.id),
      userId: owner.id,
    });

    expect(sessions.map((session) => session.id)).toEqual([
      firstSession.id,
      secondSession.id,
    ]);
  });

  it('reconstructs planning messages in order and tracks structured clarification answers', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
    });
    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
    });

    const clarificationMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'clarification_questions',
      content: 'Need a little more detail.',
      sequenceNumber: 1,
    });
    const userReply = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'user',
      content: 'Scope it to the workspace UI only.',
      sequenceNumber: 2,
    });
    await createPlanningQuestionRecord({
      sessionId: session.id,
      questionKey: 'scope-ui-surface',
      questionText: 'Which surface should own this planning experience?',
      askedInMessageId: clarificationMessage.id,
    });

    await PlanningSessionQuestions.answerQuestions(
      session.id,
      [
        {
          questionKey: 'scope-ui-surface',
          selectedOptionKey: 'workspace-ui',
          note: 'Keep this in the existing AI workspace.',
        },
      ],
      userReply.id
    );

    const messages = await PlanningSessionMessages.listMessagesForSession(session.id);
    const questions = await PlanningSessionQuestions.listQuestionsForSession(session.id);
    const nextSequenceNumber = await PlanningSessionMessages.getNextSequenceNumber(
      session.id
    );

    expect(messages.map((message) => message.sequence_number)).toEqual([1, 2]);
    expect(nextSequenceNumber).toBe(3);
    expect(questions[0]?.status).toBe('answered');
    expect(questions[0]?.answered_in_message_id).toBe(userReply.id);
    expect(questions[0]?.selected_option_key).toBe('workspace-ui');
    expect(questions[0]?.answer_note).toBe('Keep this in the existing AI workspace.');
  });

  it('claims only the latest planner-status message for processing and can update it in place', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const organization = await createOrganizationRecord({
      createdBy: owner.id,
      name: 'Platform',
    });
    const board = await createBoardRecord({
      createdBy: owner.id,
      organizationId: organization.id,
    });
    const session = await createPlanningSessionRecord({
      organizationId: organization.id,
      boardId: Number(board.id),
      createdBy: owner.id,
      plannerState: 'analyzing',
      clarificationTurnCount: 0,
    });

    await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Older failed step',
      sequenceNumber: 1,
      status: 'failed',
    });
    const latestPlannerMessage = await createPlanningSessionMessageRecord({
      sessionId: session.id,
      role: 'assistant',
      messageKind: 'planner_status',
      content: 'Analyzing',
      sequenceNumber: 2,
      status: 'pending',
      metadata: {
        stage: 'analyzing',
        userMessageId: 11,
      },
    });

    const claimedMessage = await db.transaction((trx) =>
      PlanningSessionMessages.claimLatestProcessableAssistantMessage(
        session.id,
        new Date(Date.now() - 30_000),
        trx
      )
    );

    expect(claimedMessage?.id).toBe(latestPlannerMessage.id);
    expect(claimedMessage?.status).toBe('processing');

    await PlanningSessionMessages.updateMessage(latestPlannerMessage.id, {
      messageKind: 'clarification_questions',
      content: 'Need one clarification.',
      status: 'completed',
      metadata: {
        questionKeys: ['scope-board-surface'],
      },
    });

    const messages = await PlanningSessionMessages.listMessagesForSession(session.id);

    expect(messages.at(-1)).toEqual(
      expect.objectContaining({
        id: latestPlannerMessage.id,
        message_kind: 'clarification_questions',
        status: 'completed',
      })
    );
  });
});
