import { createRoot } from 'react-dom/client';
import ConnectedApp from './connected-app';
import '../app/globals.css';
import '../app/design-system.css';
import '../app/reference-layout.css';

createRoot(document.getElementById('root')!).render(<ConnectedApp />);
