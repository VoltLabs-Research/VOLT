import { injectable } from 'tsyringe';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { NormalizedTeamSubscription } from '@modules/socket/domain/contracts/team-subscription';

export interface TeamSubscriptionContext {
    connection: ISocketConnection;
    subscription: NormalizedTeamSubscription;
}

type TeamSubscriptionHandler = (
    context: TeamSubscriptionContext
) => void | Promise<void>;

@injectable()
export default class SocketTeamSubscriptionService {
    private readonly handlers = new Set<TeamSubscriptionHandler>();

    subscribe(handler: TeamSubscriptionHandler): () => void {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    async notify(context: TeamSubscriptionContext): Promise<void> {
        for (const handler of this.handlers) {
            await handler(context);
        }
    }

    getCurrentTeamId(connection: ISocketConnection): string | undefined {
        return typeof connection.data.currentTeamId === 'string'
            ? connection.data.currentTeamId
            : undefined;
    }

    setCurrentTeamId(connection: ISocketConnection, teamId: string): void {
        connection.data.currentTeamId = teamId;

        if (connection.nativeSocket?.data) {
            connection.nativeSocket.data.currentTeamId = teamId;
        }
    }

    clearCurrentTeamId(connection: ISocketConnection): void {
        delete connection.data.currentTeamId;

        if (connection.nativeSocket?.data) {
            delete connection.nativeSocket.data.currentTeamId;
        }
    }
}
