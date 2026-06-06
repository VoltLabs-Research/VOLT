import { useRef, useState } from 'react';
import { Toaster } from 'sileo';
import type { DevModeState } from '@/services/AppConfig';
import Titlebar from '@/renderer/src/components/Titlebar';
import DevModeModal from '@/renderer/src/components/DevModeModal';
import { useDeploy, type DeployState, type PhaseStatus } from '@/renderer/src/hooks/useDeploy';

const HEADING: Record<DeployState, string> = {
    idle: 'Preparing…',
    starting: 'Deploying VOLT',
    up: 'Ready',
    stopping: 'Stopping',
    down: 'Stopped',
    error: 'Deploy failed'
};

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
    const { state, phases, phaseState, logs, voltUrl, reset, begin } = useDeploy();
    const busy = state === 'starting' || state === 'stopping';
    const [iframeReady, setIframeReady] = useState(false);
    const [devModeOpen, setDevModeOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const postToVolt = (action: 'back' | 'forward') => {
        const frame = iframeRef.current;
        if(!frame?.contentWindow || !voltUrl) return;
        frame.contentWindow.postMessage({ source: 'volt-shell', action }, new URL(voltUrl).origin);
    };

    const resetBoot = () => {
        reset();
        setIframeReady(false);
    };

    const retry = () => {
        resetBoot();
        begin();
    };

    const applyDevMode = (payload: DevModeState) => {
        setDevModeOpen(false);
        resetBoot();
        window.volt.devmode.apply(payload).catch(() => {});
    };

    const resetAndRedeploy = () => {
        resetBoot();
        window.volt.deploy.reset().catch(() => {});
    };

    return (
        <div className='app'>
            <Titlebar
                ready={iframeReady}
                busy={busy}
                onBack={() => postToVolt('back')}
                onForward={() => postToVolt('forward')}
                onOpenDevMode={() => setDevModeOpen(true)}
                onReset={resetAndRedeploy}
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
