import BoardSettingsView from '@/components/features/boardSettings/BoardSettingsView';

type BoardSettingsPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardSettingsPage({
  params,
}: BoardSettingsPageProps) {
  const { boardId } = await params;

  return <BoardSettingsView boardId={boardId} />;
}
