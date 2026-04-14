import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import ConversationList from '@/components/chat/ConversationList';

export const metadata: Metadata = {
  title: 'Messages — ChatSphere',
  description: 'Your private conversations on ChatSphere.',
  openGraph: {
    title: 'Messages — ChatSphere',
    description: 'Your private conversations on ChatSphere.',
    type: 'website',
  },
};

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="flex h-screen md:h-[100dvh]">
        {/* List panel — full on mobile, fixed-width on desktop */}
        <div className="w-full md:w-80 border-r border-gray-800 bg-gray-900 h-full overflow-hidden flex flex-col">
          <ConversationList />
        </div>
        {/* Empty state on desktop */}
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">Select a conversation</p>
            <p className="text-gray-600 text-sm mt-1">or search for someone to message</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
