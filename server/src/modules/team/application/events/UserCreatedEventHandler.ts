import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { inject, delay } from 'tsyringe';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type { IDeploymentSettingsRepository } from '@modules/system/domain/port/IDeploymentSettingsRepository';

@Subscribe('user.created')
export default class UserCreatedEventHandler implements IEventHandler<UserCreatedEvent> {
    constructor(
        @inject(delay(() => CreateNotificationUseCase))
        private readonly createNotificationUseCase: CreateNotificationUseCase,
        @inject(SYSTEM_TOKENS.DeploymentSettingsRepository)
        private readonly deploymentSettingsRepository: IDeploymentSettingsRepository
    ){}

    async handle(event: UserCreatedEvent): Promise<void> {
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
