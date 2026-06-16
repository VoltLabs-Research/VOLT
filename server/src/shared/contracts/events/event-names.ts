/**
 * Neutral, cross-module DOMAIN EVENT NAME constants.
 *
 * Part of the `shared/contracts` layer (see ECOSYSTEM "VOLT Apps" migration):
 * domain events are dispatched and subscribed-to by string name. Subscribers
 * (`@Subscribe('team.deleted')`) and emitters (`super('team.deleted', ...)`)
 * currently hard-code these strings. Centralising the names here lets either
 * side reference a single neutral constant instead of a magic string, without
 * importing the emitter module.
 *
 * These are PURELY the name strings — the event CLASSES (which extend
 * `BaseDomainEvent`) stay in their owning module. The string values are
 * byte-identical to what is emitted/subscribed today, so runtime behaviour is
 * unchanged.
 */
export const DOMAIN_EVENTS = Object.freeze({
    AnalysisCreated: 'analysis.created',
    AnalysisDeleted: 'analysis.deleted',
    AnalysisStageChanged: 'analysis.stage.changed',
    AnalysisStatusChanged: 'analysis.status.changed',
    UserCreated: 'user.created',
    UserDeleted: 'user.deleted',
    ChatDeleted: 'chat.deleted',
    UserActivityRecorded: 'user-activity.recorded',
    ContainerCreated: 'container.created',
    ContainerDeleted: 'container.deleted',
    ContainerUpdated: 'container.updated',
    JobStatusChanged: 'job.status.changed',
    LatexDocumentCreated: 'latex-document.created',
    LatexDocumentDeleted: 'latex-document.deleted',
    LatexFileContentUpdated: 'latex-file.content.updated',
    PluginCreated: 'plugin.created',
    PluginDeleted: 'plugin.deleted',
    PluginPublished: 'plugin.published',
    PluginExecutionRequest: 'PluginExecutionRequest',
    NotebookDeleted: 'notebook.deleted',
    TeamCreated: 'team.created',
    TeamDeleted: 'team.deleted',
    TeamMemberDeleted: 'team-member.deleted',
    TeamRoleCreated: 'team-role.created',
    TeamRoleDeleted: 'team-role.deleted',
    TeamRoleUpdated: 'team-role.updated',
    SecretKeyCreated: 'secret-key.created',
    SecretKeyDeleted: 'secret-key.deleted',
    InvitationSent: 'invitation.sent',
    TrajectoryCreated: 'trajectory.created',
    TrajectoryDeleted: 'trajectory.deleted',
    TrajectoryUpdated: 'trajectory.updated',
    SceneArtifactBatchUpserted: 'scene-artifact.upserted',
    WhiteboardCreated: 'whiteboard.created',
    WhiteboardDeleted: 'whiteboard.deleted'
});
