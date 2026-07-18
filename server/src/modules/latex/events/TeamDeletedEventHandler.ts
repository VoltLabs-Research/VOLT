import LatexService from '@modules/latex/services/LatexService';
import type TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * Deletes every LaTeX document owned by a deleted team (each document delete
 * cascades to its files/assets via `latex-document.deleted`). Delegates to
 * {@link LatexService} (the latex repository + use-case layers were removed in
 * the pollium conversion).
 */
@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    #service = new LatexService();

    async handle(event: TeamDeletedEvent): Promise<void> {
        await this.#service.deleteAllDocumentsForTeam(event.payload.teamId, event.payload.userId ?? '');
    }
}
