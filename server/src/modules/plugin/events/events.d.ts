import type {
    PipelineRunDeletedEventPayload,
    PluginCreatedEventPayload,
    PluginDeletedEventPayload,
    PluginExecutionRequestPayload,
    PluginPublishedEventPayload
} from '@modules/plugin/contracts/events';

declare global {
    interface EventMap {
        'pipelineRun.deleted': PipelineRunDeletedEventPayload;
        'plugin.created': PluginCreatedEventPayload;
        'plugin.deleted': PluginDeletedEventPayload;
        'plugin.published': PluginPublishedEventPayload;
        PluginExecutionRequest: PluginExecutionRequestPayload;
    }
}
