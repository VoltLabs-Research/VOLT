import { cn } from '@heroui/react';

type Volt = {
    window?: { minimize: () => void; maximize: () => void; close: () => void };
};
const volt = (): Volt | undefined => (window as unknown as { volt?: Volt }).volt;

const WindowControls = () => {
    const win = volt()?.window;

    if (!win) return null;

    return (
        <div className='volt-window-controls group/traffic flex items-center gap-2.5 [-webkit-app-region:no-drag]'>
            <span className='flex items-center gap-2'>
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#ff5f57]', "group-hover/traffic:before:content-['×']")} aria-label='Close' onClick={() => win.close()} />
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#febc2e]', "group-hover/traffic:before:content-['–']")} aria-label='Minimize' onClick={() => win.minimize()} />
                <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#28c840]', "group-hover/traffic:before:content-['+']")} aria-label='Maximize' onClick={() => win.maximize()} />
            </span>
        </div>
    );
};

export default WindowControls;
