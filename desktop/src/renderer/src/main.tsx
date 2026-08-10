import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/renderer/src/pages/App';
import { initTheme } from '@/renderer/src/theme';
import 'sileo/styles.css';
/*
 * The app's only stylesheet: HeroUI's own styles, VOLT's tokens on top of them,
 * and the handful of frameless-window rules a utility class cannot express. It is
 * imported last so that it wins over sileo's, exactly as the sheet it replaced did.
 */
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
