import { ErrorCodes } from '@core/constants/error-codes';
import Container from '@modules/container/models/Container';
import ApplicationError from '@shared/application/errors/ApplicationError';


interface ContainerRuntimeTarget{
    container: Container;
    teamClusterId: string;
}

export const requireTeamContainer = async (containerId: string, teamId: string): Promise<Container> => {
    const container = await Container.findOneBy({ id: containerId });
    if(!container){
        throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
    }
    if(container.team !== teamId){
        throw new ApplicationError(ErrorCodes.TEAM_ACCESS_DENIED, 'Container does not belong to the requested team', 403);
    }

    return container;
};

export const requireContainerRuntimeTarget = async (containerId: string, teamId: string): Promise<ContainerRuntimeTarget> => {
    const container = await requireTeamContainer(containerId, teamId);
    if(!container.teamCluster){
        throw ApplicationError.conflict(ErrorCodes.TEAM_CLUSTER_MISSING, 'Container is not assigned to a team cluster');
    }

    return {
        container,
        teamClusterId: container.teamCluster
    };
};
