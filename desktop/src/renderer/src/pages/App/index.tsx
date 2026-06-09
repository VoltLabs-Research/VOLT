import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sileo';
import type { DevModeState, DeploymentState } from '@/services/AppConfig';
import Titlebar from '@/renderer/src/components/Titlebar';
import DevModeModal from '@/renderer/src/components/DevModeModal';
import DockerGate from '@/renderer/src/components/DockerGate';
import Onboarding from '@/renderer/src/components/Onboarding';
import { useDeploy, type DeployState, type PhaseStatus } from '@/renderer/src/hooks/useDeploy';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/renderer/src/theme';

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
    const [deployment, setDeployment] = useState<DeploymentState | null>(null);
    const [devModeOpen, setDevModeOpen] = useState(false);
    const [bootError, setBootError] = useState<string | null>(null);
    const [logsCopied, setLogsCopied] = useState(false);
    const [themePref, setThemePrefState] = useState<ThemePreference>(getThemePreference());
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

    const resetBoot = () => {
        reset();
        openedRef.current = false;
        setPaused(false);
        setBootError(null);
    };

    const retry = () => run(() => window.volt.deploy.start(), resetBoot);

    const applyDevMode = (payload: DevModeState) => {
        setDevModeOpen(false);
        run(() => window.volt.devmode.apply(payload), resetBoot);
    };

    const resetAndRedeploy = async () => {
        const confirmed = await window.volt.dialog.confirm({
            title: 'Reset & redeploy',
            message: 'Reset the local Volt stack and redeploy from scratch?',
            detail: 'This stops the stack and deletes its Docker volumes — your local workspace, database and uploaded files will be permanently removed. This cannot be undone.',
            confirmLabel: 'Reset & wipe data',
            cancelLabel: 'Cancel',
            danger: true
        });
        if(!confirmed) return;
        run(() => window.volt.deploy.reset(), resetBoot);
    };

    const stopStack = () => {
        setPaused(false);
        run(() => window.volt.deploy.stop(), () => { openedRef.current = false; setBootError(null); });
    };

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
            setDeployment({ mode: 'remote', remote: { serverEndpoint: result.serverEndpoint, clientUrl: result.clientUrl } });
            openClient();
        }
        return result;
    };

    const switchDeployment = () => {
        void window.volt.deployment.reset();
        reset();
        openedRef.current = false;
        setPaused(false);
        setBootError(null);
        setDeployment(null);
        setMode('choose');
    };

    const openVolt = () => {
        setPaused(false);
        setBootError(null);
        if(mode === 'local') void start();
        else openClient();
    };

    const changeTheme = (pref: ThemePreference) => {
        setThemePreference(pref);
        setThemePrefState(pref);
        void window.volt.theme.set(pref);
    };

    const copyLogs = () => {
        const text = logs.map((line) => line.text).join('\n');
        navigator.clipboard.writeText(text)
            .then(() => {
                setLogsCopied(true);
                setTimeout(() => setLogsCopied(false), 1500);
            })
            .catch(() => {});
    };

    useEffect(() => {
        let cancelled = false;
        const intent = window.location.hash.replace('#', '');

        // Reconcile the persisted theme preference with what was applied on first paint.
        void window.volt.config.get()
            .then((config) => {
                if(cancelled) return;
                const pref: ThemePreference = config.theme === 'light' || config.theme === 'dark' ? config.theme : 'system';
                setThemePreference(pref);
                setThemePrefState(pref);
            })
            .catch(() => {});

        window.volt.deployment.get()
            .then((current) => {
                if(cancelled) return;
                setDeployment(current);
                const next: Mode = (current?.mode === 'remote' && current.remote) ? 'remote'
                    : current?.mode === 'local' ? 'local' : 'choose';

                // Actions chosen from the in-client options menu run straight away here.
                if(intent === 'switch'){ switchDeployment(); return; }
                if(intent === 'devmode'){ setMode(next); setPaused(true); setDevModeOpen(true); return; }
                if(intent === 'reset'){ setMode(next); setPaused(true); void resetAndRedeploy(); return; }
                if(intent === 'stop'){ setMode(next); stopStack(); return; }
                if(intent === 'client-error'){
                    setMode(next);
                    setPaused(true);
                    setBootError('The Volt client failed to load. It may still be starting — give it a moment and try again.');
                    return;
                }

                setMode(next);
                if(intent === 'launcher'){ setPaused(true); return; }
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

    const isLocal = mode === 'local';
    const deploymentSummary = isLocal
        ? 'Running locally via Docker on this machine.'
        : deployment?.remote?.clientUrl ?? deployment?.remote?.serverEndpoint ?? null;

    return (
        <div className='app'>
            <Titlebar
                busy={busy}
                showDeployTools={isLocal}
                theme={themePref}
                onThemeChange={changeTheme}
                onOpenDevMode={() => setDevModeOpen(true)}
                onReset={resetAndRedeploy}
                onStopStack={stopStack}
                onSwitchDeployment={switchDeployment}
            />

            <div className='body'>
                {mode === 'loading' && (
                    <main className='boot boot--center'>
                        <div className='splash'>
                            <span className='splash-mark'>Volt</span>
                            <span className='splash-spinner' aria-hidden='true' />
                        </div>
                    </main>
                )}

                {mode === 'choose' && (
                    <Onboarding onConnectRemote={connectRemote} onUseLocal={useLocal} />
                )}

                {paused && mode !== 'choose' && mode !== 'loading' && (
                    <main className='boot boot--center'>
                        <div className='ready-card'>
                            <span className='ready-eyebrow'>{isLocal ? 'Local deployment' : 'Remote deployment'}</span>
                            <span className='boot-heading'>Volt is ready</span>
                            {deploymentSummary && <span className='ready-endpoint'>{deploymentSummary}</span>}
                            {bootError && <span className='ready-error'>{bootError}</span>}

                            <div className='ready-actions'>
                                <button className='retry retry--primary' onClick={openVolt}>Open Volt</button>
                                {isLocal && <button className='retry' onClick={stopStack}>Stop stack</button>}
                                <button className='ready-link' onClick={switchDeployment}>Switch deployment</button>
                            </div>

                            {isLocal && (
                                <p className='ready-hint'>Closing the window leaves the stack running in the background. Use “Stop stack” to shut it down.</p>
                            )}
                        </div>
                    </main>
                )}

                {!paused && mode === 'remote' && (
                    <main className='boot boot--center'>
                        <div className='boot-lead boot-lead--center'>
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

                            <div className='boot-actions'>
                                {state === 'error' && <button className='retry' onClick={retry}>Retry</button>}
                                {state === 'down' && <button className='retry retry--primary' onClick={openVolt}>Start Volt</button>}
                                {state === 'error' && logs.length > 0 && (
                                    <button className='retry' onClick={copyLogs}>{logsCopied ? 'Copied' : 'Copy logs'}</button>
                                )}
                            </div>
                        </div>

                        <div className={`boot-logs${state === 'error' ? ' is-scrollable' : ''}`}>
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
