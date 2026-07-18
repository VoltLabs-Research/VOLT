import NotificationModel from '@modules/notification/models/NotificationModel';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Tiny model-backed adapter kept ONLY so the `user.deleted` cascade
 * (`deleteManyOnUserDeleted`) has a resolvable class exposing `deleteMany`. The
 * notification module's HTTP + event logic lives in
 * `services/NotificationService.ts` and talks to {@link NotificationModel}
 * directly; this class is the notification equivalent of container's
 * `ContainerSearchRepository` — a minimal adapter for a single cross-cutting
 * consumer (here, the cascade handler factory). Registered under its own class
 * token (no neutral symbol — notification has no cross-module DI consumers) and
 * autoloaded via `@Singleton`.
 */
@Singleton()
export default class NotificationRepository {
    async deleteMany(filter: Record<string, string>): Promise<number> {
        const result = await NotificationModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
}
