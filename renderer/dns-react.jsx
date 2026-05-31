import React from 'react';
import { createRoot } from 'react-dom/client';
import DnsDashboard from './components/DnsDashboard';

const rootElement = document.getElementById('react-dns-root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<DnsDashboard />);
}
