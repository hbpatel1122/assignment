import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Posts — ChatSphere',
  description: 'See the latest posts from people you follow on ChatSphere.',
  openGraph: {
    title: 'Posts — ChatSphere',
    description: 'See the latest posts from people you follow on ChatSphere.',
    type: 'website',
  },
};

export default function PostsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
