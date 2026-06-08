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
    const { state, phases, phaseState, logs, preflight, busy, reset, recheck, run, start } = useDeploy({ autoStart: false });
    const [mode, setMode] = useState<Mode>('loading');
    const [devModeOpen, setDevModeOpen] = useState(false);
    // Opened via the in-client gear (openShell adds #launcher): land here and wait for an
    // explicit action instead of bouncing straight back into the client.
    const [paused, setPaused] = useState(window.location.hash === '#launcher');
    const openedRef = useRef(false);

    // Hand the window over to the locally-served client (replaces the old iframe).
    const openClient = () => {
        if(openedRef.current) return;
        openedRef.current = true;
        void window.volt.app.openClient();
    };

    useEffect(() => {
        let cancelled = false;
        const launcher = window.location.hash === '#launcher';
        window.volt.deployment.get()
            .then((deployment) => {
                if(cancelled) return;
                const next: Mode = (deployment?.mode === 'remote' && deployment.remote) ? 'remote'
                    : deployment?.mode === 'local' ? 'local' : 'choose';
                setMode(next);
                if(launcher) return;
                if(next === 'remote') openClient();
                else if(next === 'local') void start();
            })
            .catch(() => { if(!cancelled) setMode('choose'); });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Local stack finished provisioning — open the client against it.
    useEffect(() => {
        if(mode === 'local' && state === 'up') openClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, state]);

    const resetBoot = () => {
        reset();
        openedRef.current = false;
        setPaused(false);
    };

    const retry = () => run(() => window.volt.deploy.start(), resetBoot);

    const applyDevMode = (payload: DevModeState) => {
        setDevModeOpen(false);
        run(() => window.volt.devmode.apply(payload), resetBoot);
    };

    const resetAndRedeploy = () => run(() => window.volt.deploy.reset(), resetBoot);

    const useLocal = () => {
        setPaused(false);
        setMode('local');
        void window.volt.deployment.setLocal();
        void start();
    };

    const connectRemote = async (endpoint: string) => {
        const result = await window.volt.remote.connect(endpoint);
        if(result.ok){
            setPaused(false);
            setMode('remote');
            openClient();
        }
        return result;
    };

    const switchDeployment = () => {
        void window.volt.deployment.reset();
        reset();
        openedRef.current = false;
        setPaused(false);
        setMode('choose');
    };

    const openVolt = () => {
        setPaused(false);
        if(mode === 'local') void start();
        else openClient();
    };

    const isLocal = mode === 'local';

    return (
        <div className='app'>
            <Titlebar
                busy={busy}
                showDeployTools={isLocal}
                onOpenDevMode={() => setDevModeOpen(true)}
                onReset={resetAndRedeploy}
                onSwitchDeployment={switchDeployment}
            />

            <div className='body'>
                {mode === 'choose' && (
                    <Onboarding onConnectRemote={connectRemote} onUseLocal={useLocal} />
                )}

                {paused && mode !== 'choose' && mode !== 'loading' && (
                    <main className='boot'>
                        <div className='boot-lead'>
                            <span className='boot-heading'>Volt is ready</span>
                            <button className='retry' onClick={openVolt}>Open Volt</button>
                        </div>
                    </main>
                )}

                {!paused && mode === 'remote' && (
                    <main className='boot'>
                        <div className='boot-lead'>
                            <span className='boot-heading is-loading'>Connecting…</span>
                        </div>
                    </main>
                )}

                {!paused && isLocal && preflight && (
                    <DockerGate
                        result={preflight}
                        onRecheck={recheck}
                        onOpenUrl={(target) => window.volt.shell.openExternal(target)}
                    />
                )}

                {!paused && isLocal && !preflight && (
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
