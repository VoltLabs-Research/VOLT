import { useEffect, useRef, useState } from 'react';
import { sileo, Toaster } from 'sileo';
import type { AppEvents } from '@/services/EventBus';
import Titlebar from './Titlebar';

type DeployState = AppEvents['deploy:state']['state'];

interface LogLine{
    stream: 'stdout' | 'stderr';
    text: string;
}

const STATUS: Record<DeployState, string> = {
    idle:     'Preparing…',
    starting: 'Starting Volt…',
    up:       'Connecting…',
    stopping: 'Stopping…',
    down:     'Stopped',
    error:    'Something went wrong'
};

const MAX_LINES = 800;

const errMessage = (err: unknown) => (err as any)?.message ?? String(err);

const App = () => {
    const [state, setState] = useState<DeployState>('idle');
    const [status, setStatus] = useState(STATUS.idle);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [voltUrl, setVoltUrl] = useState<string | null>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const [currentPath, setCurrentPath] = useState<string | null>(null);
    const startedRef = useRef(false);
    const termRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const append = (line: LogLine) =>
        setLogs((prev) => {
            const base = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev;
            return [...base, line];
        });

    const begin = () =>
        window.volt.deploy.start().catch((err) =>
            sileo.error({ title: 'Deploy failed', description: errMessage(err) })
        );

    const postToVolt = (message: { action: 'go' | 'back' | 'forward'; path?: string }) => {
        const frame = iframeRef.current;
        if(!frame?.contentWindow || !voltUrl) return;
        frame.contentWindow.postMessage({ source: 'volt-shell', ...message }, new URL(voltUrl).origin);
    };

    // Route reports coming back from the in-page bridge injected into VOLT.
    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const data = event.data;
            if(data?.source === 'volt-client' && typeof data.path === 'string'){
                setCurrentPath(data.path);
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    useEffect(() => {
        const unsubState = window.volt.on('deploy:state', (p) => {
            setState(p.state);
            setStatus(STATUS[p.state]);

            if(p.state === 'error'){
                const message = p.message ?? 'Unknown error';
                append({ stream: 'stderr', text: message });
                sileo.error({ title: 'Deploy failed', description: message });
            }

            if(p.state === 'up'){
                window.volt.app.voltUrl()
                    .then(setVoltUrl)
                    .catch((err) => sileo.error({ title: 'Could not open Volt', description: errMessage(err) }));
            }
        });

        const unsubLog = window.volt.on('deploy:log', (p) => {
            const text = p.line.replace(/\s+$/, '');
            if(text) append({ stream: p.stream, text });
        });

        const unsubProgress = window.volt.on('source:progress', (p) => {
            const mb = p.bytes ? ` · ${(p.bytes / 1024 / 1024).toFixed(1)} MB` : '';
            setStatus(`${p.repoId} — ${p.phase}${mb}`);
        });

        if(!startedRef.current){
            startedRef.current = true;
            begin();
        }

        return () => { unsubState(); unsubLog(); unsubProgress(); };
    }, []);

    useEffect(() => {
        const el = termRef.current;
        if(el) el.scrollTop = el.scrollHeight;
    }, [logs]);

    const retry = () => {
        setState('idle');
        setStatus(STATUS.idle);
        setLogs([]);
        setVoltUrl(null);
        setIframeReady(false);
        begin();
    };

    return (
        <div className='app'>
            <Titlebar
                ready={iframeReady}
                currentPath={currentPath}
                onNavigate={(path) => postToVolt({ action: 'go', path })}
                onBack={() => postToVolt({ action: 'back' })}
                onForward={() => postToVolt({ action: 'forward' })}
            />

            <div className='body'>
                {voltUrl && (
                    <iframe ref={iframeRef} className='volt-frame' src={voltUrl} onLoad={() => setIframeReady(true)} />
                )}

                {!iframeReady && (
                    <main className='boot'>
                        <span className={state === 'error' ? 'boot-status boot-error' : 'boot-status'}>{status}</span>

                        <div className='terminal' ref={termRef}>
                            {logs.map((line, index) => (
                                <div key={index} className={`term-line term-${line.stream}`}>{line.text}</div>
                            ))}
                        </div>

                        {state === 'error' && (
                            <button className='retry' onClick={retry}>Retry</button>
                        )}
                    </main>
                )}
            </div>

            <Toaster position='bottom-right' theme='dark' />
        </div>
    );
};

export default App;
