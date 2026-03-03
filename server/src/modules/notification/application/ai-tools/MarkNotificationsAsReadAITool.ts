import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import MarkAllUserNotificationsAsReadUseCase from '@modules/notification/application/use-cases/MarkAllUserNotificationsAsReadUseCase';

@injectable()
export class MarkNotificationsAsReadAITool extends AITool {
    readonly name = 'mark_notifications_as_read';
    readonly description = 'Mark all notifications as read.';
    readonly parameters = z.object({ reason: z.string().optional() });

    constructor(
        @inject(MarkAllUserNotificationsAsReadUseCase)
        protected readonly useCase: MarkAllUserNotificationsAsReadUseCase
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({ userId: scope.userId });
        if (!result.success) throw result.error;
        return { success: true };
    }
}
