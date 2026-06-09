import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Settings } from 'lucide-react';
import { IconButton } from '@voltstack/bravais';
import type { ThemePreference } from '@/renderer/src/theme';
import './Titlebar.css';

interface TitlebarProps{
    busy: boolean;
    showDeployTools: boolean;
    theme: ThemePreference;
    onThemeChange: (theme: ThemePreference) => void;
    onOpenDevMode: () => void;
    onReset: () => void;
    onStopStack: () => void;
    onSwitchDeployment: () => void;
}

const HOMEPAGE = 'https://github.com/voltlabs-research/volt';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
];

const Titlebar = ({
    busy,
    showDeployTools,
    theme,
    onThemeChange,
    onOpenDevMode,
    onReset,
    onStopStack,
    onSwitchDeployment
}: TitlebarProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);

    const focusGear = () => wrapRef.current?.querySelector<HTMLElement>('.settings-gear')?.focus();

    const closeMenu = (returnFocus = true) => {
        setMenuOpen(false);
        if(returnFocus) focusGear();
    };

    // Focus the first item on open and close on Escape (keyboard accessibility).
    useEffect(() => {
        if(!menuOpen) return;
        menuRef.current?.querySelector<HTMLButtonElement>('button[data-menu-item]')?.focus();
        const onKey = (event: globalThis.KeyboardEvent) => {
            if(event.key === 'Escape'){ event.preventDefault(); closeMenu(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    // Roving focus across all menu buttons (actions + theme options).
    const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        if(!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[data-menu-item]:not([disabled])') ?? []);
        if(items.length === 0) return;
        event.preventDefault();
        const currentIndex = items.findIndex((element) => element === document.activeElement);
        let nextIndex = currentIndex;
        if(event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        else if(event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        else if(event.key === 'Home') nextIndex = 0;
        else nextIndex = items.length - 1;
        items[nextIndex]?.focus();
    };

    const runAction = (action: () => void) => {
        closeMenu(false);
        action();
    };

    const openAbout = () => {
        closeMenu(false);
        void window.volt.shell.openExternal(HOMEPAGE);
    };

    return (
        <header className='titlebar'>
            <div className='traffic'>
                <button className='light close' onClick={() => window.volt.window.close()} aria-label='Close' />
                <button className='light min' onClick={() => window.volt.window.minimize()} aria-label='Minimize' />
                <button className='light max' onClick={() => window.volt.window.maximize()} aria-label='Maximize' />
            </div>

            <div className='settings-wrap' ref={wrapRef}>
                <IconButton
                    variant='ghost'
                    size='sm'
                    className={`settings-gear${menuOpen ? ' is-active' : ''}`}
                    aria-label='Settings'
                    aria-haspopup='menu'
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((value) => !value)}
                >
                    <Settings size={16} />
                </IconButton>

                {menuOpen && (
                    <>
                        <div className='menu-backdrop' onClick={() => closeMenu(false)} />
                        <ul className='menu' role='menu' ref={menuRef} onKeyDown={onMenuKeyDown}>
                            {showDeployTools && (
                                <>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className='menu-item' disabled={busy} onClick={() => runAction(onOpenDevMode)}>
                                            Dev Mode
                                        </button>
                                    </li>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className='menu-item menu-item--danger' disabled={busy} onClick={() => runAction(onReset)}>
                                            Reset &amp; Redeploy
                                        </button>
                                    </li>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className='menu-item' disabled={busy} onClick={() => runAction(onStopStack)}>
                                            Stop stack
                                        </button>
                                    </li>
                                </>
                            )}
                            <li role='none'>
                                <button type='button' role='menuitem' data-menu-item className='menu-item' disabled={busy} onClick={() => runAction(onSwitchDeployment)}>
                                    Switch deployment
                                </button>
                            </li>
                            <li role='none'>
                                <button type='button' role='menuitem' data-menu-item className='menu-item' onClick={openAbout}>
                                    About Volt
                                </button>
                            </li>

                            <li role='separator' className='menu-sep' />

                            <li role='none' className='menu-theme'>
                                <span className='menu-theme-label'>Theme</span>
                                <div className='menu-theme-options' role='group' aria-label='Theme'>
                                    {THEME_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type='button'
                                            role='menuitemradio'
                                            data-menu-item
                                            aria-checked={theme === option.value}
                                            className={`menu-theme-option${theme === option.value ? ' is-selected' : ''}`}
                                            onClick={() => onThemeChange(option.value)}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </li>
                        </ul>
                    </>
                )}
            </div>
        </header>
    );
};

export default Titlebar;
