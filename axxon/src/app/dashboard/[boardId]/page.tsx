import BoardView from '../../../components/features/boardView/BoardView'

export default async function BoardPage({ params }: any) {
  // Normalize boardId in case it comes as an array
  const boardId = Array.isArray(params.boardId) ? params.boardId[0] : params.boardId;

  return (
    <div className="flex flex-col gap-6">
      <BoardView boardId={boardId} />
    </div>
  )
}
