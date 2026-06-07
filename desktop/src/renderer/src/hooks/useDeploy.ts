import { useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { AppEvents, PhaseSpec } from '@/types/events';

export type DeployState = AppEvents['deploy:state']['state'];
export type PhaseStatus = 'pending' | 'running' | 'done' | 'error';

interface LogLine{
    stream: 'stdout' | 'stderr';
    text: string;
}

const MAX_LINES = 800;

const errMessage = (err: unknown) => (err as any)?.message ?? String(err);

export const useDeploy = () => {
    const [state, setState] = useState<DeployState>('idle');
    const [phases, setPhases] = useState<PhaseSpec[]>([]);
    const [phaseState, setPhaseState] = useState<Record<string, { status: PhaseStatus; detail?: string }>>({});
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [voltUrl, setVoltUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const startedRef = useRef(false);
    const busyRef = useRef(false);

    const append = (line: LogLine) =>
        setLogs((prev) => {
            const base = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev;
            return [...base, line];
        });

    const run = (op: () => Promise<unknown>, reset?: () => void) => {
        if(busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        reset?.();
        op().catch(() => {}).finally(() => {
            busyRef.current = false;
            setBusy(false);
        });
    };

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

        const unsubProgress = window.volt.on('source:progress', (p) => {
            const detail = p.phase === 'download' && p.bytes
                ? `downloading · ${(p.bytes / 1024 / 1024).toFixed(1)} MB`
                : p.phase;
            setPhaseState((prev) => ({ ...prev, sources: { status: 'running', detail } }));
        });

        if(!startedRef.current){
            startedRef.current = true;
            run(() => window.volt.deploy.start());
        }

        return () => { unsubState(); unsubPhases(); unsubPhase(); unsubLog(); unsubProgress(); };
    }, []);

    const reset = () => {
        setState('idle');
        setPhases([]);
        setPhaseState({});
        setLogs([]);
        setVoltUrl(null);
    };

    return { state, phases, phaseState, logs, voltUrl, busy, reset, run };
};
