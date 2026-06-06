import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import 'sileo/styles.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
