import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useEffect, useRef } from 'react';
import { localModelDragBus, remoteModelDragBus } from './live-drag-bus';

interface UseLiveModelDragOptions {
    trajectoryId?: string;
    ownerId?: string;
    isOwner: boolean;
    enabled?: boolean;
}

interface LiveDragPayload {
    trajectoryId: string;
    ownerId: string;
    sceneKey: string;
    x: number;
    y: number;
    z: number;
}

const EMIT_THROTTLE_MS = 40;

const useLiveModelDrag = ({
    trajectoryId,
    ownerId,
    isOwner,
    enabled = true
}: UseLiveModelDragOptions) => {
    const socketService = useSocket();
    const lastEmitRef = useRef(0);

    useEffect(() => {
        if (!enabled || !trajectoryId || !ownerId || !isOwner) {
            return;
        }

        return localModelDragBus.on(({ sceneKey, offset }) => {
            const now = Date.now();
            if (now - lastEmitRef.current < EMIT_THROTTLE_MS) return;
            lastEmitRef.current = now;

            socketService.emit('canvas.workspace.model_drag', {
                trajectoryId,
                ownerId,
                sceneKey,
                x: offset.x,
                y: offset.y,
                z: offset.z
            }).catch(() => undefined);
        });
    }, [enabled, trajectoryId, ownerId, isOwner, socketService]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !ownerId) {
            return;
        }

        return socketService.on('canvas.workspace.model_drag', (data) => {
            const payload = data as LiveDragPayload | undefined;
            if (!payload) return;
            if (payload.trajectoryId !== trajectoryId) return;
            if (payload.ownerId !== ownerId) return;
            if (!payload.sceneKey) return;

            remoteModelDragBus.emit({
                sceneKey: payload.sceneKey,
                offset: {
                    x: payload.x,
                    y: payload.y,
                    z: payload.z
                }
            });
        });
    }, [enabled, trajectoryId, ownerId, socketService]);
};

export default useLiveModelDrag;
