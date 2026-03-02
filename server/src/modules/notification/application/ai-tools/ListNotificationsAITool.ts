import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import GetNotificationsByUserIdUseCase from '@modules/notification/application/use-cases/GetNotificationsByUserIdUseCase';

@injectable()
export class ListNotificationsAITool extends AITool {
    readonly name = 'list_notifications';
    readonly description = 'List recent notifications for the current user.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(GetNotificationsByUserIdUseCase)
        protected readonly useCase: GetNotificationsByUserIdUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ userId: scope.userId, page: params.page, limit: params.limit });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} notifications.`,
            data: result.value.data.map((n: any) => ({
                notificationId: n.id, title: n.props.title, content: n.props.content,
                read: n.props.read, link: n.props.link ?? '', createdAt: n.props.createdAt ?? null
            })),
            total: result.value.total
        };
    }
}
