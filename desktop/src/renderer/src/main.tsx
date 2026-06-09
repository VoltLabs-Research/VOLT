import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import { initTheme } from '@/renderer/src/theme';
import 'sileo/styles.css';
import '@voltstack/bravais/styles.css';
import '@voltstack/bravais/components.css';
import './styles.css';

document.documentElement.dataset.platform = window.volt.platform;

// Flatten the shell's rounded corners while maximized (a rounded corner against the
// screen edge looks broken). Mirrors the web client's data-volt-maximized handling.
window.volt.on('window:state', ({ maximized }) => {
    if(maximized){
        document.documentElement.dataset.voltMaximized = 'true';
    }else{
        delete document.documentElement.dataset.voltMaximized;
    }
});

// Apply the cached theme preference synchronously, then keep it in sync with the OS.
// App reconciles it with the persisted config once it loads.
initTheme();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
