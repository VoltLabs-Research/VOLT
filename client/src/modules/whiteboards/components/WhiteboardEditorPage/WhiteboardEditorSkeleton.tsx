import type { CSSProperties } from 'react';

const styles = {
    root: {
        width: 'min(1200px, calc(100vw - 2rem))',
        height: 'min(780px, calc(100dvh - 2rem))',
        padding: '1rem',
        borderRadius: '1.25rem',
        border: '1px solid var(--color-border-primary)',
        background: 'linear-gradient(180deg, var(--color-surface-primary) 0%, var(--color-surface-secondary) 100%)',
        boxShadow: 'var(--shadow-card)'
    },
    toolbar: {
        height: '4rem',
        padding: '0.75rem 1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    },
    chip: {
        height: '0.875rem',
        borderRadius: '999px',
        background: 'var(--color-surface-tertiary)'
    },
    sidebar: {
        width: '18rem',
        minWidth: '15rem',
        padding: '1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    },
    canvas: {
        minHeight: '24rem',
        flex: 1,
        padding: '1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'radial-gradient(circle at top left, var(--color-surface-tertiary) 0%, var(--color-surface-primary) 60%)'
    },
    line: {
        width: '100%',
        height: '0.875rem',
        borderRadius: '999px',
        background: 'var(--color-surface-tertiary)'
    },
    floatingPanel: {
        width: '18rem',
        maxWidth: '100%',
        padding: '0.875rem 1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    }
} satisfies Record<string, CSSProperties>;

const chip = (width: string): CSSProperties => ({
    ...styles.chip,
    width
});

const line = (width: string, extra?: CSSProperties): CSSProperties => ({
    ...styles.line,
    width,
    ...extra
});

const WhiteboardEditorSkeleton = () => (
    <div className='flex flex-row items-center p-4 whiteboard-editor-loading justify-center'>
        <div style={styles.root} role='status' aria-live='polite' aria-label='Loading whiteboard workspace'>
            <div className='flex flex-col gap-4 h-full'>
                <div className='flex flex-row items-center gap-4 justify-between' style={styles.toolbar}>
                    <div className='flex flex-row items-center gap-2 flex-1'>
                        <div style={chip('8rem')} />
                        <div style={chip('5rem')} />
                    </div>
                    <div className='flex flex-row items-center gap-2'>
                        <div style={chip('2.5rem')} />
                        <div style={chip('2.5rem')} />
                        <div style={chip('2.5rem')} />
                    </div>
                </div>

                <div className='flex gap-4 flex-1' style={{ flexWrap: 'wrap' }}>
                    <div className='flex flex-col gap-3' style={styles.sidebar}>
                        <div style={line('70%')} />
                        <div style={line('100%')} />
                        <div style={line('88%')} />
                        <div style={line('92%')} />
                        <div style={line('74%')} />
                    </div>

                    <div className='flex flex-col gap-4 justify-between' style={styles.canvas}>
                        <div className='flex gap-2'>
                            <div style={chip('6rem')} />
                            <div style={chip('4rem')} />
                        </div>
                        <div className='flex justify-center'>
                            <div style={line('72%', { height: '1rem' })} />
                        </div>
                        <div className='flex items-end gap-4 justify-between'>
                            <div style={line('28%', {
                                height: '9rem',
                                borderRadius: '1rem'
                            })} />
                            <div style={line('38%', {
                                height: '13rem',
                                borderRadius: '1rem'
                            })} />
                            <div style={line('22%', {
                                height: '7rem',
                                borderRadius: '1rem'
                            })} />
                        </div>
                    </div>
                </div>

                <div className='flex justify-end'>
                    <div className='flex flex-col gap-2' style={styles.floatingPanel}>
                        <div style={line('45%')} />
                        <div style={line('100%')} />
                        <div style={line('82%')} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default WhiteboardEditorSkeleton;
