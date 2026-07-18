import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import { initTheme } from '@/renderer/src/theme';
import 'sileo/styles.css';
import '@voltstack/bravais/styles.css';
import '@voltstack/bravais/components.css';
import './styles.css';

document.documentElement.dataset.platform = window.volt.platform;

window.volt.on('window:state', ({ maximized }) => {
    if(maximized){
        document.documentElement.dataset.voltMaximized = 'true';
    }else{
        delete document.documentElement.dataset.voltMaximized;
    }
});

initTheme();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
