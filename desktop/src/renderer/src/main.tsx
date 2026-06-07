import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import 'sileo/styles.css';
import './styles.css';

document.documentElement.dataset.platform = window.volt.platform;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
