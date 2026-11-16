import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Marginalia — See it. Hear it. Understand it.',
  description: 'Two-minute AI lessons with a living whiteboard and a tutor that connects the dots.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
