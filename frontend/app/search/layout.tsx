import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search — ChatSphere',
  description: 'Search for people to connect and chat with on ChatSphere.',
  openGraph: {
    title: 'Search — ChatSphere',
    description: 'Search for people to connect and chat with on ChatSphere.',
    type: 'website',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
