import NotificationService from '@modules/notification/services/NotificationService';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';
import type { UserCreatedIntegrationEvent } from '@shared/application/contracts/events/UserCreatedIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class TeamOnboardingNotificationHandler implements IEventHandler<UserCreatedIntegrationEvent> {
    #notifications = new NotificationService();
    #deploymentSettingsService = new DeploymentSettingsService();

    async handle(event: UserCreatedIntegrationEvent): Promise<void> {
        const { id, firstName } = event.payload;

        const settings = await this.#deploymentSettingsService.getSettings();
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
