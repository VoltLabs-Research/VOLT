import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';

interface TeamSubscriptionContext {
    connection: ISocketConnection;
    subscription: {
        teamId: string;
        previousTeamId?: string;
        roomName: string;
        previousRoomName?: string;
    };
}

type TeamSubscriptionHandler = (
    context: TeamSubscriptionContext
) => void | Promise<void>;

class SocketTeamSubscriptionCoordinator {
    #handlers = new Set<TeamSubscriptionHandler>();

    subscribe(handler: TeamSubscriptionHandler): () => void{
        this.#handlers.add(handler);
        return () => {
            this.#handlers.delete(handler);
        };
    }

    async notify(context: TeamSubscriptionContext): Promise<void>{
        for(const handler of this.#handlers) await handler(context);
    }

    getCurrentTeamId(connection: ISocketConnection): string | undefined{
        return connection.data.currentTeamId;
    }

    clearCurrentTeamId(connection: ISocketConnection): void{
        delete connection.data.currentTeamId;
    }
}

export const socketTeamSubscriptionCoordinator = new SocketTeamSubscriptionCoordinator();
