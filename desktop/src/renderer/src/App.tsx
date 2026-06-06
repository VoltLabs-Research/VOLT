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

interface PhaseSpec{
    id: string;
    label: string;
}

type PhaseStatus = 'pending' | 'running' | 'done' | 'error';

const HEADING: Record<DeployState, string> = {
    idle:     'Preparing…',
    starting: 'Deploying Volt',
    up:       'Ready',
    stopping: 'Stopping',
    down:     'Stopped',
    error:    'Deploy failed'
};

const MAX_LINES = 800;

const errMessage = (err: unknown) => (err as any)?.message ?? String(err);

const StepIcon = ({ status }: { status: PhaseStatus }) => {
    if(status === 'running') return <span className='step-spinner' aria-hidden='true' />;
    if(status === 'done') return (
        <svg className='step-glyph' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M3.5 8.5l3 3 6-6.5' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
    );
    if(status === 'error') return (
        <svg className='step-glyph' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M4.5 4.5l7 7M11.5 4.5l-7 7' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
        </svg>
    );
    return <span className='step-dot' aria-hidden='true' />;
};

const App = () => {
    const [state, setState] = useState<DeployState>('idle');
    const [phases, setPhases] = useState<PhaseSpec[]>([]);
    const [phaseState, setPhaseState] = useState<Record<string, { status: PhaseStatus; detail?: string }>>({});
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

        const unsubPhases = window.volt.on('deploy:phases', (p) => {
            setPhases(p.phases);
            setPhaseState({});
        });

        const unsubPhase = window.volt.on('deploy:phase', (p) => {
            setPhaseState((prev) => ({ ...prev, [p.id]: { status: p.status, detail: p.detail } }));
        });

        const unsubLog = window.volt.on('deploy:log', (p) => {
            const text = p.line.replace(/\s+$/, '');
            if(text) append({ stream: p.stream, text });
        });

        // Stream source download/extract progress into the 'sources' step's detail line.
        const unsubProgress = window.volt.on('source:progress', (p) => {
            const detail = p.phase === 'download' && p.bytes
                ? `downloading · ${(p.bytes / 1024 / 1024).toFixed(1)} MB`
                : p.phase;
            setPhaseState((prev) => ({ ...prev, sources: { status: 'running', detail } }));
        });

        if(!startedRef.current){
            startedRef.current = true;
            begin();
        }

        return () => { unsubState(); unsubPhases(); unsubPhase(); unsubLog(); unsubProgress(); };
    }, []);

    const resetBoot = () => {
        setState('idle');
        setPhases([]);
        setPhaseState({});
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
                            <span className={[
                                'boot-heading',
                                state === 'error' ? 'boot-error' : '',
                                state === 'idle' || state === 'starting' || state === 'stopping' ? 'is-loading' : ''
                            ].filter(Boolean).join(' ')}>
                                {HEADING[state]}
                            </span>

                            {phases.length > 0 && (
                                <ol className='boot-steps'>
                                    {phases.map((phase) => {
                                        const current = phaseState[phase.id];
                                        const status = current?.status ?? 'pending';
                                        return (
                                            <li key={phase.id} className={`boot-step is-${status}`}>
                                                <StepIcon status={status} />
                                                <span className='boot-step-label'>{phase.label}</span>
                                                {current?.detail && <span className='boot-step-detail'>{current.detail}</span>}
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}

                            {state === 'error' && (
                                <button className='retry' onClick={retry}>Retry</button>
                            )}
                        </div>

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
