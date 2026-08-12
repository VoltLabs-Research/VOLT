import type {
    PluginCreatedEventPayload,
    PluginDeletedEventPayload,
    PluginExecutionRequestPayload,
    PluginPublishedEventPayload
} from '@modules/plugin/contracts/events';

declare global {
    interface EventMap {
        'plugin.created': PluginCreatedEventPayload;
        'plugin.deleted': PluginDeletedEventPayload;
        'plugin.published': PluginPublishedEventPayload;
        PluginExecutionRequest: PluginExecutionRequestPayload;
    }
}
