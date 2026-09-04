import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Toaster } from 'sileo';
import { Button, Spinner, cn } from '@heroui/react';
import type { DevModeState, DeploymentState } from '@/services/AppConfig';
import Titlebar from '@/renderer/src/components/Titlebar';
import DevModeModal from '@/renderer/src/components/DevModeModal';
import Onboarding from '@/renderer/src/components/Onboarding';
import { useDeploy, type DeployState, type PhaseStatus } from '@/renderer/src/hooks/useDeploy';
import { getResolvedTheme, getThemePreference, setThemePreference, subscribeToThemeChange, type ThemePreference } from '@/renderer/src/theme';

type Mode = 'loading' | 'choose' | 'local' | 'remote';

const HEADING: Record<DeployState, string> = {
    idle: 'Preparing…',
    starting: 'Deploying VOLT',
    up: 'Ready',
    stopping: 'Stopping',
    down: 'Stopped',
    error: 'Deploy failed'
};

const PANEL = 'absolute inset-0 z-10 flex items-center gap-[clamp(32px,6vw,80px)] px-[clamp(40px,6vw,96px)]';
const PANEL_CENTER = `${PANEL} justify-center`;

const BOOT_HEADING = 'text-[clamp(24px,2.8vw,34px)] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground';

const STEP_TONE: Record<PhaseStatus, string> = {
    pending: 'text-muted/75',
    running: 'text-foreground',
    done: 'text-muted',
    error: 'text-danger'
};

const STEP = 'flex items-center gap-3 text-[15px] leading-none transition-colors duration-200 ease-out-fluid';

const LOGS = 'flex shrink-0 grow-0 basis-[clamp(260px,32vw,430px)] flex-col justify-end self-stretch whitespace-pre-wrap break-words py-14 text-left font-mono text-[11.5px] leading-[1.7] text-muted/75';
const LOGS_AMBIENT = 'overflow-hidden [mask-image:linear-gradient(to_bottom,transparent_0,#000_88px)]';
const LOGS_READABLE = 'select-text overflow-y-auto [mask-image:none]';

const TERM_LINE = 'min-h-[1.7em] shrink-0 grow-0';

const READY_LINK = 'cursor-pointer px-3 py-2.5 text-[13px] text-muted transition-colors duration-150 ease-out-fluid hover:text-foreground hover:underline hover:underline-offset-2';

const StepIcon = ({ status }: { status: PhaseStatus }) => {
    if(status === 'running') return <Spinner size='sm' color='current' className='shrink-0' aria-hidden='true' />;
    if(status === 'done') return (
        <svg className='size-4 shrink-0' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M3.5 8.5l3 3 6-6.5' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
    );
    if(status === 'error') return (
        <svg className='size-4 shrink-0' viewBox='0 0 16 16' aria-hidden='true'>
            <path d='M4.5 4.5l7 7M11.5 4.5l-7 7' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' />
        </svg>
    );
    return <span className='size-4 shrink-0 rounded-full border-[1.5px] border-border-secondary' aria-hidden='true' />;
};

const App = () => {
    const { state, phases, phaseState, logs, busy, reset, run, start } = useDeploy({ autoStart: false });
    const [mode, setMode] = useState<Mode>('loading');
    const [deployment, setDeployment] = useState<DeploymentState | null>(null);
    const [devModeOpen, setDevModeOpen] = useState(false);
    const [bootError, setBootError] = useState<string | null>(null);
    const [logsCopied, setLogsCopied] = useState(false);
    const [themePref, setThemePrefState] = useState<ThemePreference>(getThemePreference());
    const resolvedTheme = useSyncExternalStore(subscribeToThemeChange, getResolvedTheme);

    const [paused, setPaused] = useState(window.location.hash === '#launcher');
    const openedRef = useRef(false);

    const openClient = useCallback(() => {
        if(openedRef.current) return;
        openedRef.current = true;
        void window.volt.app.openClient();
    }, []);

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
            detail: 'This stops the local stack and deletes its data folder — your local workspace, database and uploaded files will be permanently removed. This cannot be undone.',
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
            setDeployment({
                mode: 'remote',
                remote: {
                    serverEndpoint: result.serverEndpoint,
                    clientUrl: result.clientUrl
                }
            });
            openClient();
        }
        return result;
    };

    const switchDeployment = () => {
        void window.volt.deployment.reset();
        resetBoot();
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
    }, []);

    useEffect(() => {
        if(mode === 'local' && state === 'up') openClient();
    }, [mode, state, openClient]);

    const isLocal = mode === 'local';
    const deploymentSummary = isLocal
        ? 'Running locally on this machine.'
        : deployment?.remote?.clientUrl ?? deployment?.remote?.serverEndpoint ?? null;

    return (
        <div className='flex h-full flex-col'>
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
            <div className='relative min-h-0 flex-auto'>
                {mode === 'loading' && (
                    <main className={PANEL_CENTER}>
                        <div className='flex flex-col items-center gap-5'>
                            <span className='text-[clamp(28px,3vw,38px)] font-semibold tracking-[-0.02em] text-foreground'>Volt</span>
                            <Spinner color='current' className='size-[22px] text-foreground' aria-hidden='true' />
                        </div>
                    </main>
                )}

                {mode === 'choose' && (
                    <Onboarding onConnectRemote={connectRemote} onUseLocal={useLocal} />
                )}

                {paused && mode !== 'choose' && mode !== 'loading' && (
                    <main className={PANEL_CENTER}>
                        <div className='flex max-w-[460px] flex-col items-center gap-3 text-center'>
                            <span className='text-xs font-semibold uppercase tracking-[0.04em] text-muted/75'>{isLocal ? 'Local deployment' : 'Remote deployment'}</span>
                            <span className={BOOT_HEADING}>Volt is ready</span>
                            {deploymentSummary && <span className='break-all text-[13px] text-muted'>{deploymentSummary}</span>}
                            {bootError && <span className='max-w-[38ch] text-[13px] leading-[1.5] text-danger'>{bootError}</span>}

                            <div className='mt-2 flex flex-wrap items-center justify-center gap-2.5'>
                                <Button variant='primary' size='sm' onPress={openVolt}>Open Volt</Button>
                                {isLocal && <Button variant='outline' size='sm' onPress={stopStack}>Stop stack</Button>}
                                <button type='button' className={READY_LINK} onClick={switchDeployment}>Switch deployment</button>
                            </div>

                            {isLocal && (
                                <p className='mt-1 max-w-[42ch] text-xs leading-[1.5] text-muted/75'>Quitting Volt shuts the local stack down. Use “Stop stack” to stop it while the window stays open.</p>
                            )}
                        </div>
                    </main>
                )}

                {!paused && mode === 'remote' && (
                    <main className={PANEL_CENTER}>
                        <div className='flex min-w-0 flex-1 flex-col items-center gap-7 text-center'>
                            <span className={`${BOOT_HEADING} animate-pulse`}>Connecting…</span>
                        </div>
                    </main>
                )}

                {!paused && isLocal && (
                    <main className={PANEL}>
                        <div className='flex min-w-0 flex-1 flex-col items-start gap-7'>
                            <span className={cn(
                                BOOT_HEADING,
                                state === 'error' ? 'text-danger' : '',
                                state === 'idle' || state === 'starting' || state === 'stopping' ? 'animate-pulse' : ''
                            )}>
                                {HEADING[state]}
                            </span>

                            {phases.length > 0 && (
                                <ol className='flex flex-col gap-[13px]'>
                                    {phases.map((phase) => {
                                        const current = phaseState[phase.id];
                                        const status = current?.status ?? 'pending';
                                        return (
                                            <li key={phase.id} className={`${STEP} ${STEP_TONE[status]}`}>
                                                <StepIcon status={status} />
                                                <span className='tracking-[-0.01em]'>{phase.label}</span>
                                                {current?.detail && <span className='font-mono text-[11.5px] text-muted/75'>{current.detail}</span>}
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}

                            <div className='flex flex-wrap items-center gap-2.5'>
                                {state === 'error' && <Button variant='outline' size='sm' onPress={retry}>Retry</Button>}
                                {state === 'down' && <Button variant='primary' size='sm' onPress={openVolt}>Start Volt</Button>}
                                {state === 'error' && logs.length > 0 && (
                                    <Button variant='outline' size='sm' onPress={copyLogs}>{logsCopied ? 'Copied' : 'Copy logs'}</Button>
                                )}
                            </div>
                        </div>
                        <div className={cn(LOGS, state === 'error' ? LOGS_READABLE : LOGS_AMBIENT)}>
                            {logs.map((line, index) => (
                                <div key={index} className={line.stream === 'stderr' ? `${TERM_LINE} text-danger` : TERM_LINE}>{line.text}</div>
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
            <Toaster position='bottom-right' theme={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        </div>
    );
};

export default App;
