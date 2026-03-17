import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localeDetection: true,
  localePrefix: 'always',
});

export const config = {
  // تطبيق الـ middleware على كل المسارات ماعدا _next و api والملفات الثابتة
  matcher: ['/((?!_next|api|favicon\\.ico|.*\\..*).*)'],
};
