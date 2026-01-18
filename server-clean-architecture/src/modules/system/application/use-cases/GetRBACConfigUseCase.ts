import { injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetRBACConfigOutputDTO } from '@modules/system/application/dtos/GetRBACConfigDTO';

// Import constants (these should be in core/constants)
const RESOURCE_LABELS: Record<string, string> = {
    'team': 'Team',
    'trajectory': 'Trajectories',
    'team-invitation': 'Invitations',
    'team-member': 'Members',
    'team-role': 'Roles',
    'ssh-connection': 'SSH Connections',
    'plugin': 'Plugins',
    'container': 'Containers',
    'analysis': 'Analysis'
};

const ACTION_LABELS: Record<string, string> = {
    'read': 'Read',
    'create': 'Create',
    'update': 'Update',
    'delete': 'Delete'
};

@injectable()
export class GetRBACConfigUseCase implements IUseCase<void, GetRBACConfigOutputDTO> {
    async execute(): Promise<Result<GetRBACConfigOutputDTO>> {
        const resources = Object.entries(RESOURCE_LABELS).map(([key, label]) => ({
            key,
            label
        }));

        const actions = Object.entries(ACTION_LABELS).map(([key, label]) => ({
            key,
            label
        }));

        return Result.ok({
            resources,
            actions
        });
    }
}
