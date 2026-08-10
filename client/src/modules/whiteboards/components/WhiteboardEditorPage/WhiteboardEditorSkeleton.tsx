import { cn } from '@heroui/react';
import type { CSSProperties } from 'react';

/**
 * A wireframe of the Excalidraw workspace, shown while the editor chunk loads.
 *
 * The surfaces used to be inline styles reading `--color-surface-primary`,
 * `--color-surface-secondary`, `--color-surface-tertiary` and
 * `--color-border-primary`. None of those custom properties exists — they are
 * Tailwind `@theme inline` utility names, which are folded into the utilities and
 * never emitted as properties — so every panel here has been rendering with no
 * background and, because an invalid `border:` shorthand drops the whole
 * declaration, no border either. They resolve to the tokens they were reaching for.
 *
 * Only the bar widths stay inline: a computed dimension is the one thing a utility
 * cannot express, and they are the reason this is a wireframe rather than five
 * identical blocks.
 */
const PANEL_CLASS_NAMES = 'rounded-2xl border border-border bg-surface-secondary';

const BAR_CLASS_NAMES = 'h-3.5 rounded-full bg-surface-tertiary';

const ROOT_CLASS_NAMES = [
    'w-[min(1200px,calc(100vw_-_2rem))] h-[min(780px,calc(100dvh_-_2rem))] p-4',
    'rounded-[1.25rem] border border-border',
    'bg-linear-to-b from-surface to-surface-secondary',
    'shadow-[0_0_0_1px_var(--border)]'
].join(' ');

const CANVAS_CLASS_NAMES = [
    'min-h-96 flex-1 p-4 rounded-2xl border border-border',
    'bg-[radial-gradient(circle_at_top_left,var(--surface-tertiary)_0%,var(--surface)_60%)]'
].join(' ');

const width = (value: string): CSSProperties => ({ width: value });

const WhiteboardEditorSkeleton = () => (
    <div className='flex flex-row items-center justify-center w-full h-full p-4 bg-surface'>
        <div className={ROOT_CLASS_NAMES} role='status' aria-live='polite' aria-label='Loading whiteboard workspace'>
            <div className='flex flex-col gap-4 h-full'>
                <div className={cn('flex flex-row items-center gap-4 justify-between h-16 px-4 py-3', PANEL_CLASS_NAMES)}>
                    <div className='flex flex-row items-center gap-2 flex-1'>
                        <div className={BAR_CLASS_NAMES} style={width('8rem')} />
                        <div className={BAR_CLASS_NAMES} style={width('5rem')} />
                    </div>
                    <div className='flex flex-row items-center gap-2'>
                        <div className={BAR_CLASS_NAMES} style={width('2.5rem')} />
                        <div className={BAR_CLASS_NAMES} style={width('2.5rem')} />
                        <div className={BAR_CLASS_NAMES} style={width('2.5rem')} />
                    </div>
                </div>

                <div className='flex flex-wrap gap-4 flex-1'>
                    <div className={cn('flex flex-col gap-3 w-72 min-w-60 p-4', PANEL_CLASS_NAMES)}>
                        <div className={BAR_CLASS_NAMES} style={width('70%')} />
                        <div className={BAR_CLASS_NAMES} style={width('100%')} />
                        <div className={BAR_CLASS_NAMES} style={width('88%')} />
                        <div className={BAR_CLASS_NAMES} style={width('92%')} />
                        <div className={BAR_CLASS_NAMES} style={width('74%')} />
                    </div>

                    <div className={cn('flex flex-col gap-4 justify-between', CANVAS_CLASS_NAMES)}>
                        <div className='flex gap-2'>
                            <div className={BAR_CLASS_NAMES} style={width('6rem')} />
                            <div className={BAR_CLASS_NAMES} style={width('4rem')} />
                        </div>
                        <div className='flex justify-center'>
                            <div className={cn(BAR_CLASS_NAMES, 'h-4')} style={width('72%')} />
                        </div>
                        <div className='flex items-end gap-4 justify-between'>
                            <div className={cn(BAR_CLASS_NAMES, 'h-36 rounded-2xl')} style={width('28%')} />
                            <div className={cn(BAR_CLASS_NAMES, 'h-52 rounded-2xl')} style={width('38%')} />
                            <div className={cn(BAR_CLASS_NAMES, 'h-28 rounded-2xl')} style={width('22%')} />
                        </div>
                    </div>
                </div>

                <div className='flex justify-end'>
                    <div className={cn('flex flex-col gap-2 w-72 max-w-full px-4 py-3.5', PANEL_CLASS_NAMES)}>
                        <div className={BAR_CLASS_NAMES} style={width('45%')} />
                        <div className={BAR_CLASS_NAMES} style={width('100%')} />
                        <div className={BAR_CLASS_NAMES} style={width('82%')} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default WhiteboardEditorSkeleton;
