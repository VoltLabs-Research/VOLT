import { useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import './Titlebar.css';

interface TitlebarProps{
    ready: boolean;
    busy: boolean;
    navEnabled: boolean;
    showDeployTools: boolean;
    onBack: () => void;
    onForward: () => void;
    onOpenDevMode: () => void;
    onReset: () => void;
    onSwitchDeployment: () => void;
}

const ChevronLeft = () => (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M15 18l-6-6 6-6' /></svg>
);

const ChevronRight = () => (
    <svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M9 18l6-6-6-6' /></svg>
);

const Titlebar = ({ ready, busy, navEnabled, showDeployTools, onBack, onForward, onOpenDevMode, onReset, onSwitchDeployment }: TitlebarProps) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const navDisabled = !ready || !navEnabled;

    return (
        <header className='titlebar'>
            <div className='traffic'>
                <button className='light close' onClick={() => window.volt.window.close()} aria-label='Close' />
                <button className='light min' onClick={() => window.volt.window.minimize()} aria-label='Minimize' />
                <button className='light max' onClick={() => window.volt.window.maximize()} aria-label='Maximize' />
            </div>

            <div className='nav-buttons'>
                <button className='nav-btn' onClick={onBack} disabled={navDisabled} aria-label='Back'><ChevronLeft /></button>
                <button className='nav-btn' onClick={onForward} disabled={navDisabled} aria-label='Forward'><ChevronRight /></button>
            </div>

            <div className='settings-wrap'>
                <button
                    className={`nav-btn settings-btn ${menuOpen ? 'active' : ''}`}
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-label='Settings'
                >
                    <IoSettingsOutline />
                </button>

                {menuOpen && (
                    <>
                        <div className='menu-backdrop' onClick={() => setMenuOpen(false)} />
                        <ul className='menu'>
                            {showDeployTools && (
                                <>
                                    <li
                                        className={`menu-item ${busy ? 'is-disabled' : ''}`}
                                        aria-disabled={busy}
                                        onClick={busy ? undefined : () => { setMenuOpen(false); onOpenDevMode(); }}
                                    >
                                        Dev Mode
                                    </li>
                                    <li
                                        className={`menu-item ${busy ? 'is-disabled' : ''}`}
                                        aria-disabled={busy}
                                        onClick={busy ? undefined : () => { setMenuOpen(false); onReset(); }}
                                    >
                                        Reset &amp; Redeploy
                                    </li>
                                </>
                            )}
                            <li
                                className={`menu-item ${busy ? 'is-disabled' : ''}`}
                                aria-disabled={busy}
                                onClick={busy ? undefined : () => { setMenuOpen(false); onSwitchDeployment(); }}
                            >
                                Switch deployment
                            </li>
                        </ul>
                    </>
                )}
            </div>
        </header>
    );
};

export default Titlebar;
