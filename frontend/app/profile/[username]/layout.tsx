import type { Metadata } from 'next';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} — ChatSphere`,
    description: `View ${username}'s profile, posts, and connect on ChatSphere.`,
    openGraph: {
      title: `@${username} — ChatSphere`,
      description: `View ${username}'s profile, posts, and connect on ChatSphere.`,
      type: 'profile',
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
