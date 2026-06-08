import { useState } from 'react';
import { Heading, Text, Button } from '@voltstack/bravais';
import type { PreflightResult } from '@/renderer/src/hooks/useDeploy';
import './DockerGate.css';

interface DockerGateProps{
    result: PreflightResult;
    onRecheck: () => Promise<void>;
    onOpenUrl: (url: string) => void;
}

const CrossGlyph = () => (
    <svg viewBox='0 0 44 44' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
        <circle cx='22' cy='22' r='18' opacity='0.25' />
        <path d='M16 16l12 12M28 16l-12 12' />
    </svg>
);

const DockerGate = ({ result, onRecheck, onOpenUrl }: DockerGateProps) => {
    const [copied, setCopied] = useState(false);
    const [checking, setChecking] = useState(false);
    const starting = result.reason === 'daemon-starting';

    const copy = () => {
        if(!result.command) return;
        navigator.clipboard.writeText(result.command)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
    };

    const recheck = () => {
        setChecking(true);
        onRecheck().finally(() => setChecking(false));
    };

    return (
        <main className='dock-gate' role='alert'>
            <div className='dg-card'>
                <span className={`dg-glyph ${starting ? 'is-starting' : 'is-error'}`} aria-hidden='true'>
                    {starting ? <span className='dg-spinner' /> : <CrossGlyph />}
                </span>

                <Heading level={1} size='xl' weight='semibold'>{result.message}</Heading>
                <Text as='p' size='sm' tone='secondary'>{result.remediation}</Text>

                {result.command && (
                    <button type='button' className='dg-command' onClick={copy}>
                        <code>{result.command}</code>
                        <span className='dg-command-hint'>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                )}

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

                {result.detail && <p className='dg-detail'>{result.detail}</p>}
            </div>
        </main>
    );
};

export default DockerGate;
