import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@/assets/stylesheets/theme.css';
import '@/assets/stylesheets/base.css';
import '@/assets/stylesheets/general.css';
import '@/assets/stylesheets/animations.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
