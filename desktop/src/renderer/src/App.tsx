import { useEffect, useRef, useState } from 'react';
import { sileo, Toaster } from 'sileo';
import type { AppEvents } from '@/services/EventBus';
import type { DevModeState } from '@/services/AppConfig';
import Titlebar from './Titlebar';
import DevModeModal from './DevModeModal';

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
    const [devModeOpen, setDevModeOpen] = useState(false);
    const startedRef = useRef(false);
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

    const resetBoot = () => {
        setState('idle');
        setStatus(STATUS.idle);
        setLogs([]);
        setVoltUrl(null);
        setIframeReady(false);
        setCurrentPath(null);
    };

    const retry = () => {
        resetBoot();
        begin();
    };

    // Tear the iframe down back to the boot screen and let the main process
    // stop the running stack and redeploy from the newly chosen sources. Deploy
    // state/log events drive the boot screen from here on; failures surface through
    // the deploy:state 'error' listener above, so the rejection is just swallowed.
    const applyDevMode = (payload: DevModeState) => {
        setDevModeOpen(false);
        resetBoot();
        window.volt.devmode.apply(payload).catch(() => { /* surfaced via deploy:state */ });
    };

    return (
        <div className='app'>
            <Titlebar
                ready={iframeReady}
                currentPath={currentPath}
                onNavigate={(path) => postToVolt({ action: 'go', path })}
                onBack={() => postToVolt({ action: 'back' })}
                onForward={() => postToVolt({ action: 'forward' })}
                onOpenDevMode={() => setDevModeOpen(true)}
            />

            <div className='body'>
                {voltUrl && (
                    <iframe ref={iframeRef} className='volt-frame' src={voltUrl} onLoad={() => setIframeReady(true)} />
                )}

                {!iframeReady && (
                    <main className='boot'>
                        <div className='boot-lead'>
                            <span className={state === 'error' ? 'boot-status boot-error' : 'boot-status'}>{status}</span>
                            {state === 'error' && (
                                <button className='retry' onClick={retry}>Retry</button>
                            )}
                        </div>

                        {state !== 'error' && (
                            <div className='boot-loader' aria-hidden='true'>
                                <span /><span /><span /><span />
                            </div>
                        )}

                        <div className='boot-logs'>
                            {logs.map((line, index) => (
                                <div key={index} className={`term-line term-${line.stream}`}>{line.text}</div>
                            ))}
                        </div>
                    </main>
                )}
            </div>

            <DevModeModal
                open={devModeOpen}
                onClose={() => setDevModeOpen(false)}
                onApply={applyDevMode}
            />

            <Toaster position='bottom-right' theme='dark' />
        </div>
    );
};

export default App;
