import { createRoot } from 'react-dom/client';
import { Popup } from './components/popup.tsx';
import '@attentionawareness/ui/fonts.css';
import '@attentionawareness/ui/theme.css';
import './popup.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('popup.html has no #root');
}

createRoot(container).render(<Popup />);
