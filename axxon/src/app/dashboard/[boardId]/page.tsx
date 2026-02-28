import BoardView from '../../../components/features/boardView/BoardView'

type BoardPageProps = {
  params: Promise<{
    boardId: string | string[]
  }>
}

export default async function BoardPage({ params }: BoardPageProps) {
  const resolvedParams = await params
  // Normalize boardId in case it comes as an array.
  const boardId = Array.isArray(resolvedParams.boardId)
    ? resolvedParams.boardId[0]
    : resolvedParams.boardId

  return (
    <div className="flex flex-col gap-6">
      <BoardView boardId={boardId} />
    </div>
  )
}
