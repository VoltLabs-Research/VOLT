import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import ContainerService from '@modules/container/services/ContainerService';
import Container from '@modules/container/models/Container';

@DefineEventGroup('container')
export default class ContainerEvents{
    #service?: ContainerService;

    constructor(service?: ContainerService){
        this.#service = service;
    }

    @Event('team.deleted')
    async deleteTeamContainers({ teamId, userId }: EventMap['team.deleted']){
        const containers = await Container.find({
            where: { team: teamId },
            select: { id: true }
        });
        this.#service ??= new ContainerService();

        await cascadeDeleteEach({
            label: 'ContainerEvents',
            ids: containers.map((container) => container.id),
            deleteOne: async (containerId) => {
                await this.#service!.delete(teamId, containerId, userId ?? '');
            }
        });
    }
}
