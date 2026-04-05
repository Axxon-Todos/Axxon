import BoardSprintsView from '@/components/features/boardSprints/BoardSprintsView';

type BoardSprintsPageProps = {
  params: Promise<{
    boardId: string | string[];
  }>;
};

export default async function BoardSprintsPage({ params }: BoardSprintsPageProps) {
  const resolvedParams = await params;
  const boardId = Array.isArray(resolvedParams.boardId)
    ? resolvedParams.boardId[0]
    : resolvedParams.boardId;

  return <BoardSprintsView boardId={boardId} />;
}
