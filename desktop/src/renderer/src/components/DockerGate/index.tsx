import { useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import type { PreflightResult } from '@/renderer/src/hooks/useDeploy';

interface DockerGateLogLine{
    stream: 'stdout' | 'stderr';
    text: string;
}

interface DockerGateProps{
    result: PreflightResult;
    onRecheck: () => Promise<void>;
    onOpenUrl: (url: string) => void;
    /**
     * Provisioning output. The gate used to replace the log panel entirely, so
     * while the app installed Docker there was nothing on screen but a spinner —
     * a step that can legitimately take minutes, and that can fail in ways only
     * its output explains, was completely opaque.
     */
    logs?: DockerGateLogLine[];
    /** Escape hatch out of a local setup that is not going to finish. */
    onSwitchDeployment?: () => void;
}

const LOG_TAIL = 8;

/* Fixed 44px box so the glyph and the spinner occupy the same space in both states. */
const GLYPH_BOX = 'mb-1 flex size-11 items-center justify-center';

const CrossGlyph = () => (
    <svg className='size-11' viewBox='0 0 44 44' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
        <circle cx='22' cy='22' r='18' opacity='0.25' />
        <path d='M16 16l12 12M28 16l-12 12' />
    </svg>
);

/*
 * States the app is resolving by itself. They are progress, not failures: no
 * actions are offered because there is nothing for the user to do.
 */
const WORKING_REASONS = new Set(['daemon-starting', 'daemon-down', 'auto-starting', 'auto-installing']);

const DockerGate = ({ result, onRecheck, onOpenUrl, logs, onSwitchDeployment }: DockerGateProps) => {
    const [copied, setCopied] = useState(false);
    const [checking, setChecking] = useState(false);
    const working = WORKING_REASONS.has(result.reason);
    const tail = (logs ?? []).slice(-LOG_TAIL);

    const copy = () => {
        if(!result.command) return;
        navigator.clipboard.writeText(result.command)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {
                // Clipboard access can be denied; the command is on screen anyway.
            });
    };

    const recheck = () => {
        setChecking(true);
        onRecheck().finally(() => setChecking(false));
    };

    /*
     * No background of its own. The panel used to paint `--color-bg` and then undo
     * it on macOS and Windows so their vibrancy could show through; `#root` already
     * makes exactly that decision for the whole window, and this sits directly on
     * top of it with nothing in between, so inheriting is both shorter and correct
     * on every platform.
     */
    return (
        <main
            className='absolute inset-0 z-10 flex items-center justify-center p-[clamp(32px,6vw,80px)]'
            role={working ? 'status' : 'alert'}
            aria-live='polite'
        >
            <div className='flex w-full max-w-[420px] flex-col items-center gap-4 text-center'>
                <span className={working ? `${GLYPH_BOX} text-muted` : `${GLYPH_BOX} text-danger`} aria-hidden='true'>
                    {working ? <Spinner color='current' className='size-7 text-foreground' /> : <CrossGlyph />}
                </span>

                <h1 className='text-xl font-[550] text-foreground'>{result.message}</h1>
                <p className='text-xs text-muted'>{result.remediation}</p>

                {result.command && !working && (
                    <button
                        type='button'
                        className='mt-1 inline-flex max-w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-secondary px-3.5 py-2.5 transition-colors duration-150 ease-out-fluid hover:bg-default'
                        onClick={copy}
                    >
                        <code className='overflow-hidden whitespace-pre text-ellipsis font-mono text-[12.5px] text-foreground'>{result.command}</code>
                        <span className='shrink-0 text-[11px] text-muted/75'>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                )}

                {!working && (
                    <div className='mt-2 flex items-center gap-3'>
                        {result.docsUrl ? (
                            <>
                                <Button variant='primary' size='sm' onPress={() => { if(result.docsUrl) onOpenUrl(result.docsUrl); }}>{result.cta}</Button>
                                <Button variant='outline' size='sm' isPending={checking} onPress={recheck}>
                                    {checking && <Spinner size='sm' color='current' />}
                                    Re-check
                                </Button>
                            </>
                        ) : (
                            <Button variant='primary' size='sm' isPending={checking} onPress={recheck}>
                                {checking && <Spinner size='sm' color='current' />}
                                {result.cta}
                            </Button>
                        )}
                    </div>
                )}

                {result.detail && <p className='mt-1 max-w-full whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.5] text-muted/75'>{result.detail}</p>}

                {tail.length > 0 && (
                    <div className='mt-4 max-h-40 w-full overflow-y-auto rounded-xl border border-border bg-surface-secondary p-2 text-left font-mono text-xs'>
                        {tail.map((line, index) => (
                            <div
                                key={index}
                                className={line.stream === 'stderr' ? 'text-danger' : 'text-muted'}
                            >
                                {line.text}
                            </div>
                        ))}
                    </div>
                )}

                {/* Reachable during the automatic states too: a local setup that
                    cannot finish should not be a dead end. */}
                {onSwitchDeployment && (
                    <button type='button' className='mt-4 cursor-pointer text-xs text-muted/75 underline' onClick={onSwitchDeployment}>
                        Connect to a server instead
                    </button>
                )}
            </div>
        </main>
    );
};

export default DockerGate;
