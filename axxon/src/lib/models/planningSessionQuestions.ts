// Persists planning clarification questions so dedupe and resolved-state tracking survive across turns.
import db from '@/lib/db/db';
import type {
  PlanningQuestion,
  PlanningQuestionAnswerInput,
  PlanningQuestionCategory,
  PlanningQuestionOption,
  PlanningQuestionStatus,
} from '@/lib/types/organizationAiPlanningTypes';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

export class PlanningSessionQuestions {
  static async listQuestionsForSession(
    sessionId: number,
    trx: DbExecutor = db
  ): Promise<PlanningQuestion[]> {
    return trx('planning_session_questions')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc');
  }

  static async createQuestion(
    {
      sessionId,
      questionKey,
      category,
      questionText,
      whyThisMatters,
      options,
      isRequired,
      isBlocking,
      askedInMessageId,
      status = 'open',
      selectedOptionKey = null,
      answerNote = null,
      answeredInMessageId = null,
      askedAt = null,
      answeredAt = null,
    }: {
      sessionId: number;
      questionKey: string;
      category: PlanningQuestionCategory;
      questionText: string;
      whyThisMatters: string;
      options: PlanningQuestionOption[];
      isRequired: boolean;
      isBlocking: boolean;
      askedInMessageId: number | null;
      status?: PlanningQuestionStatus;
      selectedOptionKey?: string | null;
      answerNote?: string | null;
      answeredInMessageId?: number | null;
      askedAt?: Date | null;
      answeredAt?: Date | null;
    },
    trx: DbExecutor = db
  ): Promise<PlanningQuestion> {
    const [question] = await trx('planning_session_questions')
      .insert({
        session_id: sessionId,
        question_key: questionKey,
        category,
        question_text: questionText,
        why_this_matters: whyThisMatters,
        options_json: JSON.stringify(options),
        selected_option_key: selectedOptionKey,
        answer_note: answerNote,
        is_required: isRequired,
        is_blocking: isBlocking,
        asked_in_message_id: askedInMessageId,
        answered_in_message_id: answeredInMessageId,
        status,
        asked_at: askedAt,
        answered_at: answeredAt,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');

    return question;
  }

  static async answerQuestions(
    sessionId: number,
    answers: PlanningQuestionAnswerInput[],
    answeredInMessageId: number,
    trx: DbExecutor = db
  ): Promise<void> {
    for (const answer of answers) {
      await trx('planning_session_questions')
        .where({
          session_id: sessionId,
          question_key: answer.questionKey,
        })
        .update({
          status: 'answered',
          selected_option_key: answer.selectedOptionKey,
          answer_note: answer.note?.trim() || null,
          answered_in_message_id: answeredInMessageId,
          answered_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
    }
  }

  static async markOpenQuestionsAnswered(
    sessionId: number,
    answeredInMessageId: number,
    trx: DbExecutor = db
  ): Promise<void> {
    await trx('planning_session_questions')
      .where({
        session_id: sessionId,
        status: 'open',
      })
      .update({
        status: 'answered',
        answered_in_message_id: answeredInMessageId,
        answered_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  }

  static async markQuestionsAnswered(
    sessionId: number,
    questionKeys: string[],
    answeredInMessageId: number,
    trx: DbExecutor = db
  ): Promise<void> {
    if (questionKeys.length === 0) {
      return;
    }

    await trx('planning_session_questions')
      .where({ session_id: sessionId })
      .whereIn('question_key', questionKeys)
      .update({
        status: 'answered',
        answered_in_message_id: answeredInMessageId,
        answered_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  }

  static async supersedeOpenQuestions(
    sessionId: number,
    questionKeys: string[],
    trx: DbExecutor = db
  ): Promise<void> {
    if (questionKeys.length === 0) {
      return;
    }

    await trx('planning_session_questions')
      .where({ session_id: sessionId, status: 'open' })
      .whereIn('question_key', questionKeys)
      .update({
        status: 'superseded',
        updated_at: db.fn.now(),
      });
  }
}
