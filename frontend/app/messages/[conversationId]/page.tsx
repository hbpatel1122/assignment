import AppShell from '@/components/layout/AppShell';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <AppShell>
      <div className="flex h-screen md:h-[100dvh]">
        {/* Sidebar list — hidden on mobile when chat open */}
        <div className="hidden md:flex md:w-80 border-r border-gray-800 bg-gray-900 h-full overflow-hidden flex-col">
          <ConversationList />
        </div>
        {/* Chat panel */}
        <div className="flex-1 flex flex-col h-full bg-gray-950">
          <ChatWindow conversationId={conversationId} />
        </div>
      </div>
    </AppShell>
  );
}
