import { cn } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';

type Volt = {
    window?: { minimize: () => void; maximize: () => void; close: () => void };
    app?: { openShell?: (intent?: string) => void };
    shell?: { openExternal?: (url: string) => void };
    deployment?: { get?: () => Promise<{ mode?: string } | null> };
};
const volt = (): Volt | undefined => (window as unknown as { volt?: Volt }).volt;

const HOMEPAGE = 'https://github.com/voltlabs-research/volt';

/**
 * The header this sits in is the desktop shell's titlebar and drags the window, so
 * the controls have to opt back out. `-webkit-app-region` has no utility of its own,
 * hence the arbitrary property; browsers ignore the declaration, so the web build is
 * unaffected either way.
 *
 * `volt-window-controls` is kept as a bare class name — it carries no styling here —
 * because DashboardHeader.css and TopToolbar.css both name it in their own no-drag
 * rule, and dropping it would make the gaps between these controls draggable again.
 */
const ROOT_CLASS_NAMES = 'volt-window-controls group/traffic flex items-center gap-2.5 [-webkit-app-region:no-drag]';

const LAUNCHER_CLASS_NAMES = 'flex size-[26px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-[120ms] hover:bg-surface-hover hover:text-foreground';

const MENU_ITEM_CLASS_NAMES = 'cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover';

/**
 * A traffic light: a 12px coloured disc whose glyph is a pseudo-element revealed when
 * the *cluster* is hovered rather than the dot itself — the familiar macOS idiom, and
 * the reason the reveal is a group variant. `content` is set only on hover, as before.
 */
const DOT_CLASS_NAMES = 'relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100';

const WindowControls = () => {
    const win = volt()?.window;
    const openShell = volt()?.app?.openShell;
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        volt()?.deployment?.get?.().then((d) => setIsLocal(d?.mode === 'local')).catch(() => {});
    }, []);

    if (!win) return null;

    const pick = (intent: string) => { setMenuOpen(false); openShell?.(intent); };
    const openAbout = () => { setMenuOpen(false); volt()?.shell?.openExternal?.(HOMEPAGE); };

    return (
        <div className={ROOT_CLASS_NAMES}>
            {openShell && (
                <div className='relative flex items-center'>
                    <button className={LAUNCHER_CLASS_NAMES} aria-label='Options' title='Options' onClick={() => setMenuOpen((o) => !o)}>
                        <Settings size={15} />
                    </button>
                    {menuOpen && (
                        <>
                            <div className='fixed inset-0 z-40 [-webkit-app-region:no-drag]' onClick={() => setMenuOpen(false)} />
                            <ul className='absolute right-0 top-8 z-[41] m-0 min-w-[188px] list-none rounded-[10px] border border-border bg-surface-secondary p-1.5 shadow-lg'>
                                {isLocal && <li className={MENU_ITEM_CLASS_NAMES} onClick={() => pick('devmode')}>Dev Mode</li>}
                                {isLocal && <li className={MENU_ITEM_CLASS_NAMES} onClick={() => pick('reset')}>Reset &amp; Redeploy</li>}
                                {isLocal && <li className={MENU_ITEM_CLASS_NAMES} onClick={() => pick('stop')}>Stop stack</li>}
                                <li className={MENU_ITEM_CLASS_NAMES} onClick={() => pick('switch')}>Switch deployment</li>
                                <li className={MENU_ITEM_CLASS_NAMES} onClick={openAbout}>About Volt</li>
                            </ul>
                        </>
                    )}
                </div>
            )}
            <span className='flex items-center gap-2'>
                <button className={cn(DOT_CLASS_NAMES, 'bg-[#ff5f57]', "group-hover/traffic:before:content-['×']")} aria-label='Close' onClick={() => win.close()} />
                <button className={cn(DOT_CLASS_NAMES, 'bg-[#febc2e]', "group-hover/traffic:before:content-['–']")} aria-label='Minimize' onClick={() => win.minimize()} />
                <button className={cn(DOT_CLASS_NAMES, 'bg-[#28c840]', "group-hover/traffic:before:content-['+']")} aria-label='Maximize' onClick={() => win.maximize()} />
            </span>
        </div>
    );
};

export default WindowControls;
