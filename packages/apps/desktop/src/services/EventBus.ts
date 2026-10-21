import { EventEmitter } from 'node:events';
import type { AppEvents } from '@/types/events';

class EventBus{
    #emitter = new EventEmitter();

    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]){
        this.#emitter.emit(event, payload);
    }

    on<K extends keyof AppEvents>(event: K, listener: (p: AppEvents[K]) => void): () => void{
        this.#emitter.on(event, listener);
        return () => this.#emitter.off(event, listener);
    }
};

const bus = new EventBus();

export default bus;

// Provisioning output (@volt/local-stack) goes to the deploy log the launcher shows.
export const deployLog = (stream: 'stdout' | 'stderr', line: string): void => {
    bus.emit('deploy:log', {
        stream,
        line
    });
};
