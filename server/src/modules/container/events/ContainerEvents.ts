import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import { deleteContainer } from '@modules/container/services/container-provisioning';
import Container from '@modules/container/models/Container';

@DefineEventGroup('container')
export default class ContainerEvents{
    @Event('team.deleted')
    async deleteTeamContainers({ teamId, userId }: EventMap['team.deleted']){
        const containers = await Container.find({
            where: { team: teamId },
            select: { id: true }
        });

        await cascadeDeleteEach({
            label: 'ContainerEvents',
            ids: containers.map((container) => container.id),
            deleteOne: async (containerId) => {
                await deleteContainer(teamId, containerId, userId ?? '');
            }
        });
    }
}
