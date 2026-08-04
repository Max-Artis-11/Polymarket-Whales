export const metadata = { title: 'Polymarket Whale Scanner', description: 'Find whale consensus trades' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#09090b', color: '#e4e4e7' }}>{children}</body>
    </html>
  );
}
