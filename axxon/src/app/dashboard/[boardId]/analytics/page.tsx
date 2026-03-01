import BoardAnalyticsView from '@/components/features/boardAnalytics/BoardAnalyticsView';

type BoardAnalyticsPageProps = {
  params: Promise<{
    boardId: string | string[];
  }>;
};

export default async function BoardAnalyticsPage({ params }: BoardAnalyticsPageProps) {
  const resolvedParams = await params;
  const boardId = Array.isArray(resolvedParams.boardId)
    ? resolvedParams.boardId[0]
    : resolvedParams.boardId;

  return <BoardAnalyticsView boardId={boardId} />;
}
