import { useState } from 'react';
import { Settings } from 'lucide-react';
import { IconButton } from '@voltstack/bravais';
import './Titlebar.css';

interface TitlebarProps{
    busy: boolean;
    showDeployTools: boolean;
    onOpenDevMode: () => void;
    onReset: () => void;
    onSwitchDeployment: () => void;
}

const Titlebar = ({ busy, showDeployTools, onOpenDevMode, onReset, onSwitchDeployment }: TitlebarProps) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className='titlebar'>
            <div className='traffic'>
                <button className='light close' onClick={() => window.volt.window.close()} aria-label='Close' />
                <button className='light min' onClick={() => window.volt.window.minimize()} aria-label='Minimize' />
                <button className='light max' onClick={() => window.volt.window.maximize()} aria-label='Maximize' />
            </div>

            <div className='settings-wrap'>
                <IconButton
                    variant='ghost'
                    size='sm'
                    className={menuOpen ? 'is-active' : undefined}
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-label='Settings'
                >
                    <Settings size={16} />
                </IconButton>

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
