import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import Notification from '@modules/notification/models/Notification';
import NotificationService from '@modules/notification/services/NotificationService';
import DeploymentSettingsService from '@modules/system/services/DeploymentSettingsService';

@DefineEventGroup('notification')
export default class NotificationEvents {
    #notifications = new NotificationService();
    #deploymentSettingsService = new DeploymentSettingsService();

    @Event('invitation.sent')
    async notifyInvitedUser({ teamName, invitedUserId, invitationId }: EventMap['invitation.sent']) {
        await this.#notifications.create({
            recipient: invitedUserId,
            title: 'Team Invitation',
            content: `You have been invited to join the team "${teamName}"`,
            link: `/team-invitation/${invitationId}`
        });
    }

    @Event('user.created')
    async welcomeUser({ id, firstName }: EventMap['user.created']) {
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

        await this.#notifications.create({
            recipient: id,
            title: 'Welcome to the platform!',
            content: `We're excited to have you, ${capitalizedFirstName}. You can start by exploring your dashboard and uploading your first trajectory.`,
            link: '/dashboard'
        });
    }

    @Event('user.created')
    async onboardTeam({ id, firstName }: EventMap['user.created']) {
        const settings = await this.#deploymentSettingsService.getSettings();
        if (settings.props.autoJoinNewMembers && settings.props.defaultTeam) return;

        await this.#notifications.create({
            recipient: id,
            title: 'Create your first team',
            content: `Hi ${firstName}, get started by creating your first team and connecting a cluster.`,
            link: '/onboarding'
        });
    }

    @Event('user.deleted')
    async deleteUserNotifications({ userId }: EventMap['user.deleted']) {
        await Notification.delete({ recipient: userId });
    }
}
