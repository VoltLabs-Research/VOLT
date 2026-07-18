import type { Container } from '@modules/container/entities/Container';

export interface IContainerOwnershipService {
    getOwnedByTeam(containerId: string, teamId: string): Promise<Container>;
}
