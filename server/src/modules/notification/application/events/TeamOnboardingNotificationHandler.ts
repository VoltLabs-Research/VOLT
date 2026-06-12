import { CreateNotificationUseCase } from '@modules/notification/application/use-cases';
import type { UserCreatedIntegrationEvent } from '@shared/application/contracts/events/UserCreatedIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IDeploymentSettingsRepository } from '@shared/contracts/ports';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { delay, inject } from 'tsyringe';

@Subscribe('user.created')
export default class TeamOnboardingNotificationHandler implements IEventHandler<UserCreatedIntegrationEvent> {
    constructor(
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase,
        @inject(SYSTEM_CONTRACT_TOKENS.DeploymentSettingsRepository)
        private readonly deploymentSettingsRepository: IDeploymentSettingsRepository
    ) {}

    async handle(event: UserCreatedIntegrationEvent): Promise<void> {
        const { id, firstName } = event.payload;

        const settings = await this.deploymentSettingsRepository.getSettings();
        if (settings.props.autoJoinNewMembers && settings.props.defaultTeam) return;

        await this.createNotificationUseCase.execute({
            recipient: id,
            title: 'Create your first team',
            content: `Hi ${firstName}, get started by creating your first team and connecting a cluster.`,
            link: '/onboarding'
        });
    }
};
