import LatexService from '@modules/latex/services/LatexService';
import type TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    #service = new LatexService();

    async handle(event: TeamDeletedEvent): Promise<void> {
        await this.#service.deleteAllDocumentsForTeam(event.payload.teamId, event.payload.userId ?? '');
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
