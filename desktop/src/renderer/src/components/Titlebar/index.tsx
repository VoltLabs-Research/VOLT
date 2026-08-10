import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Settings } from 'lucide-react';
import { Button, cn } from '@heroui/react';
import type { ThemePreference } from '@/renderer/src/theme';

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
    {
        value: 'system',
        label: 'System'
    },
    {
        value: 'light',
        label: 'Light'
    },
    {
        value: 'dark',
        label: 'Dark'
    }
];

/*
 * The traffic lights.
 *
 * `no-drag-region` on each one is not optional: the bar around them is a
 * `drag-region`, and a draggable region swallows clicks for everything drawn over
 * it, so a control that does not punch its own hole would move the window instead
 * of closing it.
 *
 * The hover glyph used to be a `::before` with a `content` per light. It is a real
 * `aria-hidden` span now, revealed by the cluster's named group — which is what
 * lets the whole thing be classes rather than a stylesheet, since a pseudo-element
 * cannot be produced by a utility.
 */
const LIGHT = 'no-drag-region relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/10';
const GLYPH = 'absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-black/55 opacity-0 transition-opacity duration-[120ms] ease-out-fluid group-hover/traffic:opacity-100';

/*
 * The settings menu's rows stay plain `<button>`s rather than becoming HeroUI
 * `Button`s: the roving-tabindex keyboard nav below finds them with
 * `querySelectorAll('button[data-menu-item]:not([disabled])')` and calls `.focus()`,
 * which needs the native `disabled` attribute and a real DOM button — HeroUI's
 * `isDisabled` is a React Aria concept that also removes the element from the
 * press path in ways this hand-rolled menu does not expect.
 */
const MENU_ITEM = 'block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] text-foreground hover:bg-default focus-visible:bg-default disabled:cursor-default disabled:text-muted disabled:opacity-45';
const THEME_OPTION = 'flex-1 cursor-pointer rounded-[5px] px-2 py-[5px] text-xs';

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

    const focusGear = () => wrapRef.current?.querySelector<HTMLElement>('button[data-settings-gear]')?.focus();

    const closeMenu = (returnFocus = true) => {
        setMenuOpen(false);
        if(returnFocus) focusGear();
    };


    useEffect(() => {
        if(!menuOpen) return;
        menuRef.current?.querySelector<HTMLButtonElement>('button[data-menu-item]')?.focus();
        const onKey = (event: globalThis.KeyboardEvent) => {
            if(event.key === 'Escape'){ event.preventDefault(); closeMenu(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [menuOpen]);


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
        <header className='drag-region relative z-30 flex h-11 shrink-0 items-center gap-3.5 border-b border-foreground/[0.06] bg-background/70 px-3.5 backdrop-blur-[20px] backdrop-saturate-[1.8] dark:bg-background'>
            <div className='group/traffic flex items-center gap-2'>
                <button type='button' className={`${LIGHT} bg-[#ff5f57]`} onClick={() => window.volt.window.close()} aria-label='Close'>
                    <span aria-hidden='true' className={GLYPH}>&#x00d7;</span>
                </button>
                <button type='button' className={`${LIGHT} bg-[#febc2e]`} onClick={() => window.volt.window.minimize()} aria-label='Minimize'>
                    <span aria-hidden='true' className={GLYPH}>&#x2013;</span>
                </button>
                <button type='button' className={`${LIGHT} bg-[#28c840]`} onClick={() => window.volt.window.maximize()} aria-label='Maximize'>
                    <span aria-hidden='true' className={GLYPH}>+</span>
                </button>
            </div>

            <div className='relative ml-auto flex items-center' ref={wrapRef}>
                <Button
                    isIconOnly
                    variant='ghost'
                    size='sm'
                    data-settings-gear
                    className={menuOpen ? 'no-drag-region bg-default text-foreground' : 'no-drag-region'}
                    aria-label='Settings'
                    aria-haspopup='menu'
                    aria-expanded={menuOpen}
                    onPress={() => setMenuOpen((value) => !value)}
                >
                    <Settings size={16} />
                </Button>

                {menuOpen && (
                    <>
                        <div className='no-drag-region fixed inset-0 z-40' onClick={() => closeMenu(false)} />
                        <ul
                            className='no-drag-region absolute right-0 top-[34px] z-[41] min-w-[168px] rounded-xl border border-border bg-overlay/90 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur-[20px] backdrop-saturate-[1.8]'
                            role='menu'
                            ref={menuRef}
                            onKeyDown={onMenuKeyDown}
                        >
                            {showDeployTools && (
                                <>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className={MENU_ITEM} disabled={busy} onClick={() => runAction(onOpenDevMode)}>
                                            Dev Mode
                                        </button>
                                    </li>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className={cn(MENU_ITEM, 'text-danger')} disabled={busy} onClick={() => runAction(onReset)}>
                                            Reset &amp; Redeploy
                                        </button>
                                    </li>
                                    <li role='none'>
                                        <button type='button' role='menuitem' data-menu-item className={MENU_ITEM} disabled={busy} onClick={() => runAction(onStopStack)}>
                                            Stop stack
                                        </button>
                                    </li>
                                </>
                            )}
                            <li role='none'>
                                <button type='button' role='menuitem' data-menu-item className={MENU_ITEM} disabled={busy} onClick={() => runAction(onSwitchDeployment)}>
                                    Switch deployment
                                </button>
                            </li>
                            <li role='none'>
                                <button type='button' role='menuitem' data-menu-item className={MENU_ITEM} onClick={openAbout}>
                                    About Volt
                                </button>
                            </li>

                            <li role='separator' className='mx-1 my-1.5 h-px bg-border' />

                            <li role='none' className='flex flex-col gap-1.5 px-2 pb-1 pt-1.5'>
                                <span className='text-[11px] text-muted/75'>Theme</span>
                                <div className='flex gap-1 rounded-lg bg-surface-secondary p-[3px]' role='group' aria-label='Theme'>
                                    {THEME_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type='button'
                                            role='menuitemradio'
                                            data-menu-item
                                            aria-checked={theme === option.value}
                                            className={theme === option.value
                                                ? `${THEME_OPTION} bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12)]`
                                                : `${THEME_OPTION} text-muted hover:text-foreground`}
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
