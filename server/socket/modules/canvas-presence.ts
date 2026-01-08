import { Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';

interface PresenceUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
}

class CanvasPresenceModule extends BaseSocketModule {
    constructor() {
        super('CanvasPresenceModule');
    }

    onConnection(socket: Socket): void {
        this.handleViewSubscription(socket, 'canvas');
        this.handleViewSubscription(socket, 'raster');

        // Handle Disconnect
        socket.on('disconnect', async () => {
            const { viewType, trajectoryId, rasterId } = socket.data;
            if (viewType && (trajectoryId || rasterId)) {
                const room = this.getRoomName(viewType, trajectoryId, rasterId);
                if (room) {
                    await this.broadcastPresence(room, `${viewType}_users_update`, (s) => this.extractPresenceUser(s));
                }
            }
        });
    }

    private handleViewSubscription(socket: Socket, viewType: 'canvas' | 'raster') {
        const eventName = `subscribe_to_${viewType}`;
        const unsubscribeEvent = `unsubscribe_from_${viewType}`;
        const createRoomName = (payload: any) => this.getRoomName(viewType, payload.trajectoryId, payload.rasterId);

        // Subscribe
        this.wirePresenceSubscription(socket, {
            event: eventName,
            roomOf: createRoomName,
            previousOf: (payload: any) => {
                const prevId = viewType === 'raster' ? payload.previousRasterId : payload.previousTrajectoryId;
                // Basic check, strictly this might need to handle raster switching properly
                return prevId ? `${viewType}:${prevId}` : undefined;
            },
            setContext: (socket, payload: any) => {
                socket.data.trajectoryId = payload.trajectoryId;
                if (viewType === 'raster') socket.data.rasterId = payload.rasterId;
                socket.data.viewType = viewType;
                socket.data.user = payload.user;
            },
            updateEvent: `${viewType}_users_update`,
            userFromSocket: (socket) => this.extractPresenceUser(socket)
        });

        // Unsubscribe
        socket.on(unsubscribeEvent, async (payload: any) => {
            const room = createRoomName(payload);
            if (!room) return;

            this.leaveRoom(socket, room);

            socket.data.trajectoryId = undefined;
            socket.data.rasterId = undefined;
            socket.data.viewType = undefined;

            await this.broadcastPresence(room, `${viewType}_users_update`, (s) => this.extractPresenceUser(s));
        });

        // Observer
        socket.on(`observe_${viewType}_presence`, async (payload: { trajectoryId?: string }) => {
            if (!payload.trajectoryId) return;

            const observerRoom = `${viewType}-observer:${payload.trajectoryId}`;
            const mainRoom = `${viewType}:${payload.trajectoryId}`; // Note: Raster might need generic trajectory room? preserving logic.

            this.joinRoom(socket, observerRoom);

            // Immediate update
            const users = await this.collectPresence(mainRoom, (s) => this.extractPresenceUser(s));
            socket.emit(`${viewType}_users_update:${payload.trajectoryId}`, users);
        });
    }

    private getRoomName(viewType: string, trajectoryId?: string, rasterId?: string): string | undefined {
        if (viewType === 'raster') {
            if (rasterId) return `raster:${rasterId}`;
            if (trajectoryId) return `raster:${trajectoryId}`;
            return undefined;
        }
        return trajectoryId ? `canvas:${trajectoryId}` : undefined;
    }

    private extractPresenceUser(socket: Socket): PresenceUser {
        const user = (socket as any).user;
        const isAnonymous = !user || !user._id;

        return {
            id: user?._id?.toString() || socket.id,
            email: user?.email,
            firstName: user?.firstName,
            lastName: user?.lastName,
            isAnonymous
        };
    }
}

export default CanvasPresenceModule;
