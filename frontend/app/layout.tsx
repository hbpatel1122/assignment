import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: {
    default: 'ChatSphere — Real-time Messaging',
    template: '%s',
  },
  description: 'ChatSphere — private messaging with real-time delivery, typing indicators, posts, and a follow system.',
  keywords: ['chat', 'messaging', 'social', 'real-time', 'ChatSphere'],
  openGraph: {
    siteName: 'ChatSphere',
    title: 'ChatSphere — Real-time Messaging',
    description: 'Private messaging with real-time delivery, typing indicators, and follow system.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ChatSphere — Real-time Messaging',
    description: 'Private messaging with real-time delivery, typing indicators, and follow system.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-950 text-white">
        {children}
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #1f2937',
              color: '#f9fafb',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  );
}
