import { createRoot } from 'react-dom/client';
import { Options } from './components/options.tsx';
import '@attentionawareness/ui/fonts.css';
import '@attentionawareness/ui/theme.css';
import './page.css';
import './css-editor.css';
import './focus.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('options.html has no #root');
}

createRoot(container).render(<Options />);
