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
        <div className='volt-window-controls group/traffic flex items-center gap-2.5 [-webkit-app-region:no-drag]'>
            {openShell && (
                <div className='relative flex items-center'>
                    <button className='flex size-[26px] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-muted transition-colors duration-[120ms] hover:bg-surface-hover hover:text-foreground' aria-label='Options' title='Options' onClick={() => setMenuOpen((o) => !o)}>
                        <Settings size={15} />
                    </button>
                    {menuOpen && (
                        <>
                            <div className='fixed inset-0 z-40 [-webkit-app-region:no-drag]' onClick={() => setMenuOpen(false)} />
                            <ul className='absolute right-0 top-8 z-[41] m-0 min-w-[188px] list-none rounded-[10px] border border-border bg-surface-secondary p-1.5 shadow-lg'>
                                {isLocal && <li className='cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover' onClick={() => pick('devmode')}>Dev Mode</li>}
                                {isLocal && <li className='cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover' onClick={() => pick('reset')}>Reset &amp; Redeploy</li>}
                                {isLocal && <li className='cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover' onClick={() => pick('stop')}>Stop stack</li>}
                                <li className='cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover' onClick={() => pick('switch')}>Switch deployment</li>
                                <li className='cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-[13px] text-foreground hover:bg-surface-hover' onClick={openAbout}>About Volt</li>
                            </ul>
                        </>
                    )}
                </div>
            )}
            <span className='flex items-center gap-2'>
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#ff5f57]', "group-hover/traffic:before:content-['×']")} aria-label='Close' onClick={() => win.close()} />
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#febc2e]', "group-hover/traffic:before:content-['–']")} aria-label='Minimize' onClick={() => win.minimize()} />
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#28c840]', "group-hover/traffic:before:content-['+']")} aria-label='Maximize' onClick={() => win.maximize()} />
            </span>
        </div>
    );
};

export default WindowControls;
