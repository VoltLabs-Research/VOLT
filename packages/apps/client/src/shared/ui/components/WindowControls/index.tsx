import { cn } from '@heroui/react';
import { useLayoutEffect, useSyncExternalStore } from 'react';

type Volt = {
    window?: { minimize: () => void; maximize: () => void; close: () => void };
};
type VoltWindow = NonNullable<Volt['window']>;
const volt = (): Volt | undefined => (window as unknown as { volt?: Volt }).volt;

// A header with room for the controls hosts them. Where none is mounted (the boot screen, the error and
// not-found pages), the window's corner shows them, so they are always there.
let hostCount = 0;
const hostListeners = new Set<() => void>();

const changeHostCount = (delta: number): void => {
    hostCount += delta;
    hostListeners.forEach((listener) => listener());
};

const subscribeToHosts = (listener: () => void): (() => void) => {
    hostListeners.add(listener);
    return () => {
        hostListeners.delete(listener);
    };
};

const isHosted = (): boolean => hostCount > 0;

const TrafficLights = ({ win }: { win: VoltWindow }) => (
    <div className='volt-window-controls group/traffic flex items-center gap-2.5 [-webkit-app-region:no-drag]'>
        <span className='flex items-center gap-2'>
            <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#ff5f57]', "group-hover/traffic:before:content-['×']")} aria-label='Close' onClick={() => win.close()} />
            <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#febc2e]', "group-hover/traffic:before:content-['–']")} aria-label='Minimize' onClick={() => win.minimize()} />
            <button className={cn('relative size-3 cursor-pointer rounded-full border-[0.5px] border-black/12 p-0 before:absolute before:inset-0 before:flex before:items-center before:justify-center before:text-[9px] before:font-bold before:leading-none before:text-black/55 before:opacity-0 before:transition-opacity before:duration-[120ms] before:content-[""] group-hover/traffic:before:opacity-100', 'bg-[#28c840]', "group-hover/traffic:before:content-['+']")} aria-label='Maximize' onClick={() => win.maximize()} />
        </span>
    </div>
);

const WindowControls = () => {
    const win = volt()?.window;

    useLayoutEffect(() => {
        if (!win) return;
        changeHostCount(1);
        return () => changeHostCount(-1);
    }, [win]);

    if (!win) return null;

    return <TrafficLights win={win} />;
};

export const CornerWindowControls = () => {
    const isHostedByHeader = useSyncExternalStore(subscribeToHosts, isHosted);
    const win = volt()?.window;

    if (!win || isHostedByHeader) return null;

    return (
        <div className='fixed top-0 right-0 z-[var(--z-modal)] flex h-14 items-center px-4 lg:px-6'>
            <TrafficLights win={win} />
        </div>
    );
};

export default WindowControls;
