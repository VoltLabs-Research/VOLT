import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';

@DefineEventGroup('whiteboards')
export default class WhiteboardEvents{
    #service = new WhiteboardService();

    @Event('team.deleted')
    async deleteTeamWhiteboards({ teamId, userId }: EventMap['team.deleted']){
        const whiteboards = await Whiteboard.find({
            where: { team: teamId },
            select: { id: true }
        });

        await cascadeDeleteEach({
            label: 'WhiteboardEvents',
            ids: whiteboards.map((whiteboard) => whiteboard.id),
            deleteOne: (whiteboardId) => this.#service.deleteWhiteboard(teamId, whiteboardId, userId ?? '')
        });
    }
}
