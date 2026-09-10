import type { Preview } from '@storybook/react-vite';
import '@fontsource-variable/inter';
import '../src/fonts.css';
import '../src/theme.css';
import './preview.css';

if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV === true) {
  // Hot CSS reloads for StyleX in dev; the stylesheet itself is linked in
  // previewHead (see main.ts). No-op in production builds.
  void import('virtual:stylex:runtime');
}

const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
  },
};

export default preview;
