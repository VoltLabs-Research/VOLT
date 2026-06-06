import { useEffect, useRef, useState } from 'react';
import type { AppEvents } from '@/services/EventBus';

type DeployState = AppEvents['deploy:state']['state'];

const STATE_TEXT: Record<DeployState, string> = {
    idle:     'Preparing Volt…',
    starting: 'Starting Volt…',
    up:       'Connecting to Volt…',
    stopping: 'Stopping…',
    down:     'Stopped',
    error:    'Something went wrong'
};

const errMessage = (err: unknown) => (err as any)?.message ?? String(err);

const App = () => {
    const [state, setState] = useState<DeployState>('idle');
    const [hint, setHint] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [voltUrl, setVoltUrl] = useState<string | null>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const startedRef = useRef(false);

    useEffect(() => {
        const unsubState = window.volt.on('deploy:state', (p) => {
            setState(p.state);
            if(p.state === 'error') setError(p.message ?? 'unknown error');
            if(p.state === 'up'){
                window.volt.app.voltUrl().then(setVoltUrl).catch((err) => setError(errMessage(err)));
            }
        });

        const unsubLog = window.volt.on('deploy:log', (p) => {
            const trimmed = p.line.trim();
            if(trimmed) setHint(trimmed);
        });

        const unsubProgress = window.volt.on('source:progress', (p) => {
            const mb = p.bytes ? ` · ${(p.bytes / 1024 / 1024).toFixed(1)} MB` : '';
            setHint(`${p.repoId} — ${p.phase}${mb}`);
        });

        if(!startedRef.current){
            startedRef.current = true;
            window.volt.deploy.start().catch((err) => setError(errMessage(err)));
        }

        return () => { unsubState(); unsubLog(); unsubProgress(); };
    }, []);

    const retry = () => {
        setError(null);
        setHint('');
        setState('idle');
        setVoltUrl(null);
        setIframeReady(false);
        window.volt.deploy.start().catch((err) => setError(errMessage(err)));
    };

    const showSplash = !iframeReady;

    return (
        <>
            {voltUrl && (
                <iframe
                    className="volt-frame"
                    src={voltUrl}
                    onLoad={() => setIframeReady(true)}
                />
            )}

            {showSplash && (
                <div className="splash">
                    <div className="brand">VOLT</div>

                    {error ? (
                        <>
                            <div className="state error">{STATE_TEXT.error}</div>
                            <div className="hint">{error}</div>
                            <button className="retry" onClick={retry}>Retry</button>
                        </>
                    ) : (
                        <>
                            <div className="bar"><div className="bar-fill" /></div>
                            <div className="state">{STATE_TEXT[state]}</div>
                            {hint && <div className="hint">{hint}</div>}
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default App;
