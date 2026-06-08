import { Settings } from 'lucide-react';
import './WindowControls.css';

// The desktop preload (Electron) injects `window.volt`; in a plain browser it is
// absent, so the whole control set renders nothing and the header stays a normal header.
const windowApi = (): { minimize: () => void; maximize: () => void; close: () => void } | undefined =>
    (window as unknown as { volt?: { window?: any } }).volt?.window;

const launcher = (): (() => void) | undefined =>
    (window as unknown as { volt?: { app?: { openShell?: () => void } } }).volt?.app?.openShell;

const WindowControls = () => {
    const win = windowApi();
    if (!win) return null;
    const openShell = launcher();

    return (
        <div className='volt-window-controls'>
            {openShell && (
                <button className='vwc-launcher' aria-label='Deployment & tools' title='Deployment & tools' onClick={openShell}>
                    <Settings size={15} />
                </button>
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
