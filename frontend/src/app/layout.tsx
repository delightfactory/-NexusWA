import React from 'react';

export const metadata = {
  title: 'NexusWA — منصة ربط واتساب',
  description: 'منصة احترافية لربط أرقام واتساب عبر الويب وتقديم API لإرسال الإشعارات',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
