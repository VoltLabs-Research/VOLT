import type { ModelDragOffset } from '@/modules/fractal/stores/contracts/editor/scene-types';

type Listener = (offset: ModelDragOffset) => void;

const createBus = () => {
    const listeners = new Set<Listener>();

    return {
        on(listener: Listener): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        emit(offset: ModelDragOffset): void {
            listeners.forEach((listener) => listener(offset));
        }
    };
};

export const localModelDragBus = createBus();
export const remoteModelDragBus = createBus();
