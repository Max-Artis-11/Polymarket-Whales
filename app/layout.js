export const metadata = {
  title: 'Polymarket Whale Scanner',
  description: 'Find consensus trades among top Polymarket wallets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#09090b', color: '#e4e4e7' }}>
        {children}
      </body>
    </html>
  );
}
