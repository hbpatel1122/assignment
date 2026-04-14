import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'People — ChatSphere',
  description: 'Discover and connect with people on ChatSphere.',
  openGraph: {
    title: 'People — ChatSphere',
    description: 'Discover and connect with people on ChatSphere.',
    type: 'website',
  },
};

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
