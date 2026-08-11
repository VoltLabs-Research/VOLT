import { useCallback, useEffect, useRef, useState } from 'react';
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

    const run = useCallback((op: () => Promise<unknown>, reset?: () => void) => {
        if(busyRef.current) return false;
        busyRef.current = true;
        setBusy(true);
        reset?.();
        op().catch(() => {}).finally(() => {
            busyRef.current = false;
            setBusy(false);
        });
        return true;
    }, []);

    const boot = useCallback(async ({ clear = true }: { clear?: boolean } = {}): Promise<void> => {
        run(() => window.volt.deploy.start(), clear ? () => setPreflight(null) : undefined);
    }, [run]);

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
    }, [autoStart, boot]);

    const preflightReason = preflight?.reason;

    useEffect(() => {
        if(!preflightReason || !AUTOMATIC_REASONS.has(preflightReason)) return;
        if(busyRef.current) return;
        const id = setInterval(() => { void boot({ clear: false }); }, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [preflightReason, boot]);

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
