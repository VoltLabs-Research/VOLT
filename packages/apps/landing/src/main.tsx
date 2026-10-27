import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LandingPage from '@/components/LandingPage';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <LandingPage />
    </StrictMode>
);
