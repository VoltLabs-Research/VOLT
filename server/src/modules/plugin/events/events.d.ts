import type { PluginCreatedEventPayload } from '@modules/plugin/events/PluginCreatedEvent';
import type { PluginDeletedEventPayload } from '@modules/plugin/events/PluginDeletedEvent';
import type { PluginExecutionRequestPayload } from '@modules/plugin/events/PluginExecutionRequestEvent';
import type { PluginPublishedEventPayload } from '@modules/plugin/events/PluginPublishedEvent';

declare global {
    interface EventMap {
        'plugin.created': PluginCreatedEventPayload;
        'plugin.deleted': PluginDeletedEventPayload;
        'plugin.published': PluginPublishedEventPayload;
        // Legacy name kept as-is: this one predates the `namespace.action` convention.
        PluginExecutionRequest: PluginExecutionRequestPayload;
    }
}
