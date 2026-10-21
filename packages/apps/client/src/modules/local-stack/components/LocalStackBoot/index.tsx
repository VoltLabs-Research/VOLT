import { bootLocalStack, type LocalStackPhaseStatus } from '@/modules/local-stack/services/boot-local-stack';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import Scrollable from '@/shared/ui/components/Scrollable';
import { LOCAL_STACK_PHASES, type LocalStackPhaseId } from '@volt/local-stack/provision';
import { Button } from '@heroui/react';
import { Check, CircleAlert, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface LocalStackBootProps {
    onReady: () => void;
}

const MAX_LOG_LINES = 200;

const PhaseIcon = ({ status }: { status?: LocalStackPhaseStatus }) => {
    if (status === 'done') return <Check size={16} className='text-success' aria-label='Done' />;
    if (status === 'error') return <CircleAlert size={16} className='text-danger' aria-label='Failed' />;
    if (status === 'running') return <LoaderCircle size={16} className='animate-spin text-foreground' aria-label='Running' />;
    return <span className='size-4 rounded-full border border-border' aria-hidden />;
};

// Shown while the page starts the VOLT it runs itself; the app renders once that serves it.
const LocalStackBoot = ({ onReady }: LocalStackBootProps) => {
    const [phases, setPhases] = useState<Partial<Record<LocalStackPhaseId, LocalStackPhaseStatus>>>({});
    const [log, setLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const started = useRef(false);

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

    const leaveLocalMode = async () => {
        await localStackMode.disable();
        window.location.assign('/connect');
    };

    return (
        <main className='min-h-dvh bg-background'>
            <section className='flex min-h-dvh flex-col justify-center p-6 max-sm:p-4' aria-labelledby='local-stack-title'>
                <div className='mx-auto flex w-full max-w-[26rem] flex-col gap-8'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-3xl font-semibold tracking-[-0.03em] text-foreground max-lg:text-2xl' id='local-stack-title'>Starting VOLT in this browser</h1>
                        <p>The server and a compute cluster run in this tab. Your work is kept in this browser's storage.</p>
                    </header>

                    <ol className='flex flex-col gap-3' aria-live='polite'>
                        {LOCAL_STACK_PHASES.map((phase) => (
                            <li key={phase.id} className='flex items-center gap-3 text-sm'>
                                <PhaseIcon status={phases[phase.id]} />
                                <span className={phases[phase.id] ? 'text-foreground' : 'text-muted'}>{phase.label}</span>
                            </li>
                        ))}
                    </ol>

                    {error && (
                        <div className='flex flex-col gap-4'>
                            <p className='text-sm text-danger' role='alert'>{error}</p>
                            <div className='flex gap-2'>
                                <Button variant='primary' onPress={() => window.location.reload()}>Try again</Button>
                                <Button variant='secondary' onPress={() => void leaveLocalMode()}>Connect to a server instead</Button>
                            </div>
                        </div>
                    )}

                    {log.length > 0 && (
                        <Scrollable className='max-h-48 rounded-md border border-border/70 p-3'>
                            <pre className='text-xs leading-relaxed text-muted'>{log.join('\n')}</pre>
                        </Scrollable>
                    )}
                </div>
            </section>
        </main>
    );
};

export default LocalStackBoot;
