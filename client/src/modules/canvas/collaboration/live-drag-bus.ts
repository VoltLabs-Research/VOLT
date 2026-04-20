import type { ModelDragOffset } from '@/modules/fractal/stores/contracts/editor/scene-types';

export interface ModelDragEvent {
    sceneKey: string;
    offset: ModelDragOffset;
};

type Listener = (event: ModelDragEvent) => void;

const createBus = () => {
    const listeners = new Set<Listener>();

    return {
        on(listener: Listener): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        emit(event: ModelDragEvent): void {
            listeners.forEach((listener) => listener(event));
        }
    };
};

export const localModelDragBus = createBus();
export const remoteModelDragBus = createBus();
