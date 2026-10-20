import '@/shared/ui/assets/stylesheets/fonts.css';
import '@/shared/ui/assets/stylesheets/index.css';
import Mockup from './Mockup';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const theme = new URLSearchParams(window.location.search).get('theme');
if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Mockup />
    </StrictMode>
);
