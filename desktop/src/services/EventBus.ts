import { EventEmitter } from 'node:events';

export interface AppEvents{
    'deploy:log': {
        stream: 'stdout' | 'stderr';
        line: string;
    },
    'deploy:state': {
        state: 'idle' | 'starting' | 'up' | 'stopping' | 'down' | 'error';
        message?: string;
    },
    'source:progress': {
        repoId: string;
        phase: 'download' | 'extract' | 'done';
        bytes?: number;
    },
    // Ordered step list for the current deploy operation, declared up front so the
    // renderer can show every upcoming phase (Vercel-style) before it runs.
    'deploy:phases': {
        phases: { id: string; label: string }[];
    },
    // A single phase advancing through its lifecycle.
    'deploy:phase': {
        id: string;
        status: 'running' | 'done' | 'error';
        detail?: string;
    }
};

class EventBus{
    #emitter = new EventEmitter({ captureRejections: true });

    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]){
        this.#emitter.emit(event, payload);
    }

    on<K extends keyof AppEvents>(event: K, listener: (p: AppEvents[K]) => void): () => void{
        this.#emitter.on(event, listener);
        return () => this.#emitter.off(event, listener);
    }
};

export default new EventBus();