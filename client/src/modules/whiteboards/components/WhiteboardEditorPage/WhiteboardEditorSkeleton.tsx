import type { CSSProperties } from 'react';

const width = (value: string): CSSProperties => ({ width: value });

const WhiteboardEditorSkeleton = () => (
    <div className='flex flex-row items-center justify-center w-full h-full p-4 bg-surface'>
        <div
            className='w-[min(1200px,calc(100vw_-_2rem))] h-[min(780px,calc(100dvh_-_2rem))] p-4 rounded-[1.25rem] border border-border bg-linear-to-b from-surface to-surface-secondary shadow-[0_0_0_1px_var(--border)]'
            role='status'
            aria-live='polite'
            aria-label='Loading whiteboard workspace'
        >
            <div className='flex flex-col gap-4 h-full'>
                <div className='flex flex-row items-center gap-4 justify-between h-16 px-4 py-3 rounded-2xl border border-border bg-surface-secondary'>
                    <div className='flex flex-row items-center gap-2 flex-1'>
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('8rem')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('5rem')} />
                    </div>
                    <div className='flex flex-row items-center gap-2'>
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('2.5rem')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('2.5rem')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('2.5rem')} />
                    </div>
                </div>
                <div className='flex flex-wrap gap-4 flex-1'>
                    <div className='flex flex-col gap-3 w-72 min-w-60 p-4 rounded-2xl border border-border bg-surface-secondary'>
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('70%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('100%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('88%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('92%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('74%')} />
                    </div>
                    <div className='flex flex-col gap-4 justify-between min-h-96 flex-1 p-4 rounded-2xl border border-border bg-[radial-gradient(circle_at_top_left,var(--surface-tertiary)_0%,var(--surface)_60%)]'>
                        <div className='flex gap-2'>
                            <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('6rem')} />
                            <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('4rem')} />
                        </div>
                        <div className='flex justify-center'>
                            <div className='h-4 rounded-full bg-surface-tertiary' style={width('72%')} />
                        </div>
                        <div className='flex items-end gap-4 justify-between'>
                            <div className='h-36 rounded-2xl bg-surface-tertiary' style={width('28%')} />
                            <div className='h-52 rounded-2xl bg-surface-tertiary' style={width('38%')} />
                            <div className='h-28 rounded-2xl bg-surface-tertiary' style={width('22%')} />
                        </div>
                    </div>
                </div>
                <div className='flex justify-end'>
                    <div className='flex flex-col gap-2 w-72 max-w-full px-4 py-3.5 rounded-2xl border border-border bg-surface-secondary'>
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('45%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('100%')} />
                        <div className='h-3.5 rounded-full bg-surface-tertiary' style={width('82%')} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default WhiteboardEditorSkeleton;
