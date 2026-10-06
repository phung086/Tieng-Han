import { ConversationLab } from "@/components/conversation-lab";

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { lesson } = await searchParams;
  return (
    <div className="page">
      <ConversationLab lessonId={Number(lesson ?? 1)} />
    </div>
  );
}
