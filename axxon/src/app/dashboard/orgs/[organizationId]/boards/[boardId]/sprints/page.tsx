import BoardSprintsView from '@/components/features/boardSprints/BoardSprintsView';

type BoardSprintsPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardSprintsPage({ params }: BoardSprintsPageProps) {
  const { boardId } = await params;

  return <BoardSprintsView boardId={boardId} />;
}
