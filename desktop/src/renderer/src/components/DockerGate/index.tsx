import { useState } from 'react';
import { Heading, Text, Button } from '@voltstack/bravais';
import type { PreflightResult } from '@/renderer/src/hooks/useDeploy';
import './DockerGate.css';

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

const CrossGlyph = () => (
    <svg viewBox='0 0 44 44' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
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

    return (
        <main className='dock-gate' role={working ? 'status' : 'alert'} aria-live='polite'>
            <div className='dg-card'>
                <span className={`dg-glyph ${working ? 'is-starting' : 'is-error'}`} aria-hidden='true'>
                    {working ? <span className='dg-spinner' /> : <CrossGlyph />}
                </span>

                <Heading level={1} size='xl' weight='semibold'>{result.message}</Heading>
                <Text as='p' size='sm' tone='secondary'>{result.remediation}</Text>

                {result.command && !working && (
                    <button type='button' className='dg-command' onClick={copy}>
                        <code>{result.command}</code>
                        <span className='dg-command-hint'>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                )}

                {!working && (
                    <div className='dg-actions'>
                        {result.docsUrl ? (
                            <>
                                <Button intent='brand' size='sm' onClick={() => result.docsUrl && onOpenUrl(result.docsUrl)}>{result.cta}</Button>
                                <Button variant='outline' size='sm' isLoading={checking} onClick={recheck}>Re-check</Button>
                            </>
                        ) : (
                            <Button intent='brand' size='sm' isLoading={checking} onClick={recheck}>{result.cta}</Button>
                        )}
                    </div>
                )}

                {result.detail && <p className='dg-detail'>{result.detail}</p>}

                {tail.length > 0 && (
                    <div className='mt-4 w-full max-h-40 overflow-y-auto rounded-md border border-soft bg-surface-2 p-2 text-left font-mono text-xs'>
                        {tail.map((line, index) => (
                            <div
                                key={index}
                                className={line.stream === 'stderr' ? 'text-danger' : 'text-secondary'}
                            >
                                {line.text}
                            </div>
                        ))}
                    </div>
                )}

                {/* Reachable during the automatic states too: a local setup that
                    cannot finish should not be a dead end. */}
                {onSwitchDeployment && (
                    <button type='button' className='mt-4 text-sm text-muted underline' onClick={onSwitchDeployment}>
                        Connect to a server instead
                    </button>
                )}
            </div>
        </main>
    );
};

export default DockerGate;
