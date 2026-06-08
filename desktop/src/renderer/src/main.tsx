import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import 'sileo/styles.css';
import '@voltstack/bravais/styles.css';
import '@voltstack/bravais/components.css';
import './styles.css';

document.documentElement.dataset.platform = window.volt.platform;

// bravais scopes its design tokens under :root[data-theme]; mirror the OS scheme
// onto the root so the package's components resolve their colours.
const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => { document.documentElement.dataset.theme = themeQuery.matches ? 'dark' : 'light'; };
applyTheme();
themeQuery.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
