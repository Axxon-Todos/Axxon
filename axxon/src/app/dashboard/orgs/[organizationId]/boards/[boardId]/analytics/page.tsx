import BoardAnalyticsView from '@/components/features/boardAnalytics/BoardAnalyticsView';

type BoardAnalyticsPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardAnalyticsPage({
  params,
}: BoardAnalyticsPageProps) {
  const { boardId } = await params;
  return <BoardAnalyticsView boardId={boardId} />;
}
