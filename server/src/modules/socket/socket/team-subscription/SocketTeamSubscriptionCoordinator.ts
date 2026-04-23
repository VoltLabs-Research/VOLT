
import type { NormalizedTeamSubscription } from '@modules/socket/domain/contracts/team-subscription';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { Singleton } from '@shared/infrastructure/di/decorators';

export interface TeamSubscriptionContext {
    connection: ISocketConnection;
    subscription: NormalizedTeamSubscription;
}

type TeamSubscriptionHandler = (
    context: TeamSubscriptionContext
) => void | Promise<void>;

@Singleton()
@Singleton()
export default class SocketTeamSubscriptionCoordinator {
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
    }

    clearCurrentTeamId(connection: ISocketConnection): void {
        delete connection.data.currentTeamId;
    }
}
