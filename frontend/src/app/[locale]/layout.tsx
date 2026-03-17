import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import '@/styles/globals.css';
import { Toaster } from 'react-hot-toast';

export default async function RootLayout({
  children,
  params: {locale},
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NexusWA — منصة ربط واتساب</title>
        <meta name="description" content="منصة احترافية لربط أرقام واتساب عبر الويب وتقديم API لإرسال الإشعارات" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '14px' },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
