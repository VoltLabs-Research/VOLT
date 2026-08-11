import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { AppEvents, PhaseSpec } from '@/types/events';

export type DeployState = AppEvents['deploy:state']['state'];
export type PhaseStatus = 'pending' | 'running' | 'done' | 'error';
export type PreflightResult = AppEvents['deploy:preflight'];

interface PhaseProgress{
    status: PhaseStatus;
    detail?: string;
}

const POLL_INTERVAL = 2_000;

/*
 * The main process now owns provisioning: `deploy.start()` starts or installs the
 * runtime itself and reports progress through `deploy:preflight`. These are the
 * states it is actively working on, so the gate shows them as progress and the
 * renderer must not kick off a competing attempt.
 */
const AUTOMATIC_REASONS = new Set(['daemon-starting', 'daemon-down', 'auto-starting', 'auto-installing']);

interface LogLine{
    stream: 'stdout' | 'stderr';
    text: string;
}

const MAX_LINES = 800;

interface UseDeployOptions{
    autoStart?: boolean;
}

export const useDeploy = ({ autoStart = true }: UseDeployOptions = {}) => {
    const [state, setState] = useState<DeployState>('idle');
    const [phases, setPhases] = useState<PhaseSpec[]>([]);
    const [phaseState, setPhaseState] = useState<Record<string, PhaseProgress>>({});
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [preflight, setPreflight] = useState<PreflightResult | null>(null);
    const [busy, setBusy] = useState(false);
    const startedRef = useRef(false);
    const busyRef = useRef(false);

    const append = (line: LogLine) =>
        setLogs((prev) => {
            const base = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev;
            return [...base, line];
        });

    const run = (op: () => Promise<unknown>, reset?: () => void) => {
        if(busyRef.current) return false;
        busyRef.current = true;
        setBusy(true);
        reset?.();
        op().catch(() => {}).finally(() => {
            busyRef.current = false;
            setBusy(false);
        });
        return true;
    };

    /**
     * Starts the deploy without pre-gating on Docker.
     *
     * This used to probe Docker first and stop at the gate when it was missing,
     * which meant the automatic provisioning inside `deploy.start()` was never
     * reached. The gate is now driven purely by `deploy:preflight` events.
     *
     * `clear` distinguishes a deliberate restart from the background re-check
     * below. A user pressing Retry should see the gate reset; the two-second poll
     * should not, because clearing the preflight unmounts the gate and remounts it
     * on the next event — which reads as a flickering, stuck window rather than as
     * "still waiting for Docker".
     */
    const boot = async ({ clear = true }: { clear?: boolean } = {}): Promise<void> => {
        run(() => window.volt.deploy.start(), clear ? () => setPreflight(null) : undefined);
    };

    useEffect(() => {
        const unsubState = window.volt.on('deploy:state', (p) => {
            setState(p.state);

            if(p.state === 'error'){
                const message = p.message ?? 'Unknown error';
                append({
                    stream: 'stderr',
                    text: message
                });
                sileo.error({
                    title: 'Deploy failed',
                    description: message
                });
            }
        });

        const unsubPhases = window.volt.on('deploy:phases', (p) => {
            setPhases(p.phases);
            setPhaseState({});
        });

        const unsubPhase = window.volt.on('deploy:phase', (p) => {
            setPhaseState((prev) => ({
                ...prev,
                [p.id]: {
                    status: p.status,
                    detail: p.detail
                }
            }));
        });

        const unsubLog = window.volt.on('deploy:log', (p) => {
            const text = p.line.replace(/\s+$/, '');
            if(text) append({
                stream: p.stream,
                text
            });
        });

        const unsubProgress = window.volt.on('source:progress', (p) => {
            if(p.phase === 'done'){
                setPhaseState((prev) => ({
                    ...prev,
                    sources: { status: prev.sources?.status ?? 'running' }
                }));
                return;
            }

            const detail = p.phase === 'download'
                ? p.pct != null
                    ? `downloading · ${p.pct}%`
                    : p.bytes
                        ? `downloading · ${(p.bytes / 1024 / 1024).toFixed(1)} MB`
                        : 'downloading'
                : 'extracting';

            setPhaseState((prev) => ({
                ...prev,
                sources: {
                    status: 'running',
                    detail
                }
            }));
        });

        const unsubPreflight = window.volt.on('deploy:preflight', (p) => {
            setPreflight(p.ok ? null : p);
        });

        if(!startedRef.current){
            startedRef.current = true;
            if(autoStart) void boot();
        }

        return () => { unsubState(); unsubPhases(); unsubPhase(); unsubLog(); unsubProgress(); unsubPreflight(); };
    }, []);

    /*
     * A terminal preflight state ends the deploy, so nothing is polling any more.
     * `daemon-starting` and `daemon-down` can still be reached without a deploy in
     * flight (Docker quit while the app was open), and there retrying is correct.
     */
    useEffect(() => {
        if(!preflight || !AUTOMATIC_REASONS.has(preflight.reason)) return;
        if(busyRef.current) return;
        const id = setInterval(() => { void boot({ clear: false }); }, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [preflight?.reason]);

    const reset = () => {
        setState('idle');
        setPhases([]);
        setPhaseState({});
        setLogs([]);
        setPreflight(null);
    };

    return {
        state,
        phases,
        phaseState,
        logs,
        preflight,
        busy,
        reset,
        run,
        start: boot
    };
};
