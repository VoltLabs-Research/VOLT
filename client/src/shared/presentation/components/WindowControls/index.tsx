import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import './WindowControls.css';

// The desktop preload (Electron) injects `window.volt`; absent in a plain browser, so the
// whole control set renders nothing and the header stays a normal header.
type Volt = {
    window?: { minimize: () => void; maximize: () => void; close: () => void };
    app?: { openShell?: (intent?: string) => void };
    shell?: { openExternal?: (url: string) => void };
    deployment?: { get?: () => Promise<{ mode?: string } | null> };
};
const volt = (): Volt | undefined => (window as unknown as { volt?: Volt }).volt;

const HOMEPAGE = 'https://github.com/voltlabs-research/volt';

const WindowControls = () => {
    const win = volt()?.window;
    const openShell = volt()?.app?.openShell;
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        volt()?.deployment?.get?.().then((d) => setIsLocal(d?.mode === 'local')).catch(() => {});
    }, []);

    if (!win) return null;

    // Deployment actions need the desktop shell (redeploy progress / onboarding); the menu
    // itself stays in-place — only the chosen action hands off to the shell.
    const pick = (intent: string) => { setMenuOpen(false); openShell?.(intent); };
    const openAbout = () => { setMenuOpen(false); volt()?.shell?.openExternal?.(HOMEPAGE); };

    return (
        <div className='volt-window-controls'>
            {openShell && (
                <div className='vwc-menu-wrap'>
                    <button className='vwc-launcher' aria-label='Options' title='Options' onClick={() => setMenuOpen((o) => !o)}>
                        <Settings size={15} />
                    </button>
                    {menuOpen && (
                        <>
                            <div className='vwc-backdrop' onClick={() => setMenuOpen(false)} />
                            <ul className='vwc-menu'>
                                {isLocal && <li className='vwc-item' onClick={() => pick('devmode')}>Dev Mode</li>}
                                {isLocal && <li className='vwc-item' onClick={() => pick('reset')}>Reset &amp; Redeploy</li>}
                                {isLocal && <li className='vwc-item' onClick={() => pick('stop')}>Stop stack</li>}
                                <li className='vwc-item' onClick={() => pick('switch')}>Switch deployment</li>
                                <li className='vwc-item' onClick={openAbout}>About Volt</li>
                            </ul>
                        </>
                    )}
                </div>
            )}
            <span className='vwc-traffic'>
                <button className='vwc-dot vwc-close' aria-label='Close' onClick={() => win.close()} />
                <button className='vwc-dot vwc-min' aria-label='Minimize' onClick={() => win.minimize()} />
                <button className='vwc-dot vwc-max' aria-label='Maximize' onClick={() => win.maximize()} />
            </span>
        </div>
    );
};

export default WindowControls;
