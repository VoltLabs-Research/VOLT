import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import type { WhiteboardServiceDependencies } from '@modules/whiteboards/services/WhiteboardService';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';

@DefineEventGroup('whiteboards')
export default class WhiteboardEvents{
    #dependencies: WhiteboardServiceDependencies;

    #service?: WhiteboardService;

    constructor(dependencies: WhiteboardServiceDependencies = {}){
        this.#dependencies = dependencies;
    }

    @Event('team.deleted')
    async deleteTeamWhiteboards({ teamId, userId }: EventMap['team.deleted']){
        const whiteboards = await Whiteboard.find({
            where: { team: teamId },
            select: { id: true }
        });
        this.#service ??= new WhiteboardService(this.#dependencies);

        await cascadeDeleteEach({
            label: 'WhiteboardEvents',
            ids: whiteboards.map((whiteboard) => whiteboard.id),
            deleteOne: async (whiteboardId) => {
                await this.#service!.deleteWhiteboard(teamId, whiteboardId, userId ?? '');
            }
        });
    }
}
