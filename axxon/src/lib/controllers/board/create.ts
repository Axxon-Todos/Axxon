import { Board } from '@/lib/models/board'; 
import type { BoardCreation } from '@/lib/types/boardTypes';

export async function createBoardController(input: {
  userId: number;
  data: BoardCreation;
}) {
  const { userId, data } = input;

  const board = await Board.createBoard({...data, created_by: userId});

  return board;
}
