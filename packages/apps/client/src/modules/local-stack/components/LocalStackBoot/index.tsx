import { bootLocalStack, type LocalStackPhaseStatus } from '@/modules/local-stack/services/boot-local-stack';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import Scrollable from '@/shared/ui/components/Scrollable';
import { useThemeInitialization } from '@/shared/ui/hooks/use-theme';
import { LOCAL_STACK_PHASES, type LocalStackPhaseId } from '@volt/local-stack/provision';
import { Button } from '@heroui/react';
import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface LocalStackBootProps {
    onReady: () => void;
}

const MAX_LOG_LINES = 200;

const PhaseIcon = ({ status }: { status?: LocalStackPhaseStatus }) => {
    if (status === 'done') return <Check size={16} className='shrink-0 text-success' aria-label='Done' />;
    if (status === 'error') return <CircleAlert size={16} className='shrink-0 text-danger' aria-label='Failed' />;
    if (status === 'running') return <LoaderCircle size={16} className='shrink-0 animate-spin text-foreground' aria-label='Running' />;
    return <span className='size-4 shrink-0 rounded-full border border-foreground/15' aria-hidden />;
};

// Shown while the page starts the VOLT it runs itself; the app renders once that serves it.
const LocalStackBoot = ({ onReady }: LocalStackBootProps) => {
    const [phases, setPhases] = useState<Partial<Record<LocalStackPhaseId, LocalStackPhaseStatus>>>({});
    const [log, setLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const started = useRef(false);
    const logRef = useRef<HTMLDivElement>(null);
    const inDesktopApp = localStackMode.isDesktopApp();

    // The app, which applies the saved theme, is not mounted yet.
    useThemeInitialization();

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        bootLocalStack({
            onPhase: (id, status) => setPhases((current) => ({ ...current, [id]: status })),
            onLog: (_stream, line) => setLog((current) => [...current.slice(1 - MAX_LOG_LINES), line])
        }).then((ready) => {
            if (ready) onReady();
        }).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : String(cause));
        });
    }, [onReady]);

    // An open log follows its newest line.
    useLayoutEffect(() => {
        const element = logRef.current;
        if (element) element.scrollTop = element.scrollHeight;
    }, [log]);

    const leaveLocalMode = async () => {
        await localStackMode.disable();
        window.location.assign('/connect');
    };

    return (
        <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-18' aria-labelledby='local-stack-title'>
            <div className='flex w-full max-w-sm flex-col gap-8'>
                <h1 className='text-3xl font-semibold tracking-tight text-foreground sm:text-4xl' id='local-stack-title'>{inDesktopApp ? 'Starting VOLT' : 'Starting VOLT in this browser'}</h1>

                <ol className='flex flex-col gap-1' aria-label='Startup phases' aria-live='polite'>
                    {LOCAL_STACK_PHASES.map((phase) => (
                        <li key={phase.id} className='flex items-center gap-3 text-base'>
                            <PhaseIcon status={phases[phase.id]} />
                            <span className={phases[phase.id] ? 'text-foreground' : 'text-muted'}>{phase.label}</span>
                        </li>
                    ))}
                </ol>

                {error && (
                    <div className='flex flex-col gap-4'>
                        <p className='text-sm text-danger-soft-foreground' role='alert'>{error}</p>
                        <div className='flex flex-wrap gap-2'>
                            <Button variant='primary' size='sm' onPress={() => window.location.reload()}>Try again</Button>
                            {!inDesktopApp && <Button variant='secondary' size='sm' onPress={() => void leaveLocalMode()}>Connect to a server instead</Button>}
                        </div>
                    </div>
                )}

                {log.length > 0 && (
                    <details className='group'>
                        <summary className='w-fit cursor-pointer list-none text-sm text-muted transition-colors hover:text-foreground group-open:mb-3 [&::-webkit-details-marker]:hidden'>Show log</summary>
                        <Scrollable ref={logRef} className='max-h-48 rounded-xl bg-foreground/4 px-4 py-3' aria-label='Startup log'>
                            <pre className='font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted'>{log.join('\n')}</pre>
                        </Scrollable>
                    </details>
                )}
            </div>
        </main>
    );
};

export default LocalStackBoot;
