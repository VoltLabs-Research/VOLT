import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import NotificationService from '@modules/notification/services/NotificationService';
import type { GetNotificationsInput } from '@volt/contracts/modules/notification/ai-tools';

export default class NotificationAIToolController extends AIToolController {
    #service = new NotificationService();

    @AITool({
        name: 'get_notifications',
        description: 'List the current user\'s notifications (newest first), optionally filtered to only unread ones.',
        parameters: typia.llm.parameters<GetNotificationsInput>(),
        validate: typia.createValidate<GetNotificationsInput>()
    })
    async getNotifications(input: GetNotificationsInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread.
        const { data, total, page, limit, totalPages } = await this.#service.getMyNotifications({
            page: 1,
            limit: 20,
            ...input
        });

        const unreadCount = data.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);

        const notifications = input.unreadOnly
            ? data.filter((notification) => !notification.read)
            : data;

        return {
            summary: `Returned ${notifications.length} notification(s) (${unreadCount} unread on this page).`,
            data: {
                notifications,
                total,
                page,
                limit,
                totalPages
            }
        };
    }
}
