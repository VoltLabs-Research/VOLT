import { useState } from 'react';
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

                <h1 className='dg-title'>{result.message}</h1>
                <p className='dg-body'>{result.remediation}</p>

                {result.command && (
                    <button type='button' className='dg-command' onClick={copy}>
                        <code>{result.command}</code>
                        <span className='dg-command-hint'>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                )}

                <div className='dg-actions'>
                    {result.docsUrl ? (
                        <>
                            <button className='dg-cta' onClick={() => result.docsUrl && onOpenUrl(result.docsUrl)}>{result.cta}</button>
                            <button className='dg-secondary' onClick={recheck} disabled={checking}>{checking ? 'Checking…' : 'Re-check'}</button>
                        </>
                    ) : (
                        <button className='dg-cta' onClick={recheck} disabled={checking}>{checking ? 'Checking…' : result.cta}</button>
                    )}
                </div>

                {result.detail && <p className='dg-detail'>{result.detail}</p>}
            </div>
        </main>
    );
};

export default DockerGate;
