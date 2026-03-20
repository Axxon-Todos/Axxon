import BoardWorkspace from '@/components/features/boardView/BoardWorkspace';

type BoardPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <BoardWorkspace boardId={boardId} />
    </div>
  );
}
