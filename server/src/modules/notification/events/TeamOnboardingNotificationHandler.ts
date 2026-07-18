import NotificationService from '@modules/notification/services/NotificationService';
import DeploymentSettingsRepository from '@modules/system/repositories/DeploymentSettingsRepository';
import type { UserCreatedIntegrationEvent } from '@shared/application/contracts/events/UserCreatedIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TeamOnboardingNotificationHandler implements IEventHandler<UserCreatedIntegrationEvent> {
    #notifications = new NotificationService();
    #deploymentSettingsRepository = new DeploymentSettingsRepository();

    async handle(event: UserCreatedIntegrationEvent): Promise<void> {
        const { id, firstName } = event.payload;

        const settings = await this.#deploymentSettingsRepository.getSettings();
        if (settings.props.autoJoinNewMembers && settings.props.defaultTeam) return;

        await this.#notifications.create({
            recipient: id,
            title: 'Create your first team',
            content: `Hi ${firstName}, get started by creating your first team and connecting a cluster.`,
            link: '/onboarding'
        });
    }
};

const teamOnboardingNotificationHandler = new TeamOnboardingNotificationHandler();
subscribeHandler('user.created', teamOnboardingNotificationHandler);

export default teamOnboardingNotificationHandler;
