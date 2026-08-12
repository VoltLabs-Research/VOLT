import { ErrorCodes } from '@core/constants/error-codes';
import containerPortProxyRelayService from '@modules/container/services/ContainerPortProxyRelayService';
import { requireTeamContainer } from '@modules/container/services/container-lookup';
import { resolveAccessiblePorts } from '@modules/container/services/container-network';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ContainerAccessiblePort } from '@volt/contracts/modules/container/domain';


export const createContainerPortAccessUrl = async (
    teamId: string,
    containerId: string,
    privatePort: number,
    userId: string
): Promise<{ url: string; expiresAt: string; port: ContainerAccessiblePort }> => {
    const container = await requireTeamContainer(containerId, teamId);
    const accessiblePorts = resolveAccessiblePorts(container.ports, container.status);
    const port = accessiblePorts.find((item) => item.private === privatePort);

    if(!port){
        throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container port is not exposed');
    }
    if(!port.browserAccessible){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Container port is not browser accessible');
    }
    if(port.status !== 'available'){
        throw ApplicationError.conflict(ErrorCodes.CONTAINER_PORT_UNAVAILABLE, 'Container must be running to open this port');
    }
    if(!port.public){
        throw ApplicationError.conflict(ErrorCodes.CONTAINER_PUBLIC_PORT_UNAVAILABLE, 'Container port has no public port assigned');
    }

    const teamClusterId = container.teamCluster || undefined;
    if(!teamClusterId || !container.internalIp){
        throw ApplicationError.conflict(ErrorCodes.CONTAINER_PORT_UNAVAILABLE, 'Container networking is not ready yet');
    }

    const accessUrl = await containerPortProxyRelayService.createAccessUrl({
        teamId,
        containerId: container.id,
        userId,
        teamClusterId,
        internalIp: container.internalIp,
        privatePort,
        publicPort: port.public
    });

    return {
        url: accessUrl.url,
        expiresAt: accessUrl.expiresAt,
        port
    };
};
