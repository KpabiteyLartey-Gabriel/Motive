import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/lib/ThemeProvider';

const geist = GeistSans;

export const metadata = {
  title: '+Motive — Vehicle Operations & Fleet Management Platform',
  description:
    '+Motive connects vehicle owners, drivers, transport companies and fleet managers on one unified platform in Ghana.',
  keywords: 'Ghana vehicle fleet management, commercial vehicle platform, transport company Ghana, driver app Ghana',
  openGraph: {
    title: '+Motive',
    description: 'Vehicle Operations, Mobility, Contract, Payment and Fleet Management Platform for Ghana',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={geist.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('gh_motive_theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');})();`,
          }}
        />
      </head>
      <body className={geist.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
