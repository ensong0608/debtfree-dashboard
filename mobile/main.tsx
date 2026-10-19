import { createRoot } from 'react-dom/client';
import DashboardClient from '../app/dashboard-client';
import { createDemoRepository } from './demo-repository';
import '../app/globals.css';
import '../app/design-system.css';
import '../app/reference-layout.css';

const root = createRoot(document.getElementById('root')!);
async function start() {
  try {
    const repository = await createDemoRepository(window.localStorage);
    root.render(<DashboardClient user={{ email: 'Local device storage only', displayName: 'Sample user', fullName: null }} repository={repository} syntheticDemo />);
  } catch (error) {
    root.render(<main className="onboarding-shell"><section role="alert"><strong>Synthetic demo</strong><p>{error instanceof Error ? error.message : 'Demo storage is unavailable.'}</p></section></main>);
  }
}
void start();
