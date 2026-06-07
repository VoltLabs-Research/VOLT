import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sileo';
import type { DevModeState } from '@/services/AppConfig';
import Titlebar from '@/renderer/src/components/Titlebar';
import DevModeModal from '@/renderer/src/components/DevModeModal';
import DockerGate from '@/renderer/src/components/DockerGate';
import Onboarding from '@/renderer/src/components/Onboarding';
import { useDeploy, type DeployState, type PhaseStatus } from '@/renderer/src/hooks/useDeploy';

type Mode = 'loading' | 'choose' | 'local' | 'remote';

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
    const { state, phases, phaseState, logs, voltUrl, preflight, busy, reset, recheck, run, start } = useDeploy({ autoStart: false });
    const [mode, setMode] = useState<Mode>('loading');
    const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
    const [iframeReady, setIframeReady] = useState(false);
    const [devModeOpen, setDevModeOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // The local stack injects __nav-bridge.js (back/forward + auth token); a remote
    // deployment serves its own client, so the shell just points the frame at it.
    const url = mode === 'remote' ? remoteUrl : voltUrl;

    useEffect(() => {
        let cancelled = false;
        window.volt.deployment.get()
            .then((deployment) => {
                if(cancelled) return;
                if(deployment?.mode === 'remote' && deployment.remote?.clientUrl){
                    setRemoteUrl(deployment.remote.clientUrl);
                    setMode('remote');
                }else if(deployment?.mode === 'local'){
                    setMode('local');
                    void start();
                }else{
                    setMode('choose');
                }
            })
            .catch(() => { if(!cancelled) setMode('choose'); });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const postToVolt = (action: 'back' | 'forward') => {
        const frame = iframeRef.current;
        if(!frame?.contentWindow || !url) return;
        frame.contentWindow.postMessage({ source: 'volt-shell', action }, new URL(url).origin);
    };

    const resetBoot = () => {
        reset();
        setIframeReady(false);
    };

    const retry = () => run(() => window.volt.deploy.start(), resetBoot);

    const applyDevMode = (payload: DevModeState) => {
        setDevModeOpen(false);
        run(() => window.volt.devmode.apply(payload), resetBoot);
    };

    const resetAndRedeploy = () => run(() => window.volt.deploy.reset(), resetBoot);

    const useLocal = () => {
        setMode('local');
        void window.volt.deployment.setLocal();
        void start();
    };

    const connectRemote = async (endpoint: string) => {
        const result = await window.volt.remote.connect(endpoint);
        if(result.ok){
            setIframeReady(false);
            setRemoteUrl(result.clientUrl);
            setMode('remote');
        }
        return result;
    };

    const switchDeployment = () => {
        void window.volt.deployment.reset();
        reset();
        setRemoteUrl(null);
        setIframeReady(false);
        setMode('choose');
    };

    const isLocal = mode === 'local';

    return (
        <div className='app'>
            <Titlebar
                ready={iframeReady}
                busy={busy}
                navEnabled={isLocal}
                showDeployTools={isLocal}
                onBack={() => postToVolt('back')}
                onForward={() => postToVolt('forward')}
                onOpenDevMode={() => setDevModeOpen(true)}
                onReset={resetAndRedeploy}
                onSwitchDeployment={switchDeployment}
            />

            <div className='body'>
                {url && (
                    <iframe ref={iframeRef} className='volt-frame' src={url} onLoad={() => setIframeReady(true)} />
                )}

                {mode === 'choose' && (
                    <Onboarding onConnectRemote={connectRemote} onUseLocal={useLocal} />
                )}

                {mode === 'remote' && !iframeReady && (
                    <main className='boot'>
                        <div className='boot-lead'>
                            <span className='boot-heading is-loading'>Connecting…</span>
                        </div>
                    </main>
                )}

                {isLocal && !iframeReady && preflight && (
                    <DockerGate
                        result={preflight}
                        onRecheck={recheck}
                        onOpenUrl={(target) => window.volt.shell.openExternal(target)}
                    />
                )}

                {isLocal && !iframeReady && !preflight && (
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
