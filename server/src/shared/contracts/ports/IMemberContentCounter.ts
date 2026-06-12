/**
 * Neutral port for contributing per-member content COUNTS to the team-member
 * listing, without the team (kernel) module importing feature modules.
 *
 * The team module's `ListTeamMembersByTeamIdUseCase` historically injected the
 * trajectory / analysis / latex / whiteboard repositories directly to compute
 * each member's `trajectoriesCount` / `analysesCount` / `latexCount` /
 * `whiteboardsCount`. That made the KERNEL depend UP into optional leaf/compute
 * features — blocking their detachment.
 *
 * Inversion (detachable-modules migration): each feature module registers a
 * counter via `@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)`; team resolves
 * the collection (`@injectAll`) and merges the results. When a feature is
 * disabled its counter simply isn't registered, so its key is absent — the UI
 * degrades gracefully (count treated as 0).
 */
export interface MemberContentCountResult {
    /** Stable key identifying this metric, e.g. 'trajectoriesCount'. */
    readonly key: string;
    /** userId -> count for the requested team. */
    readonly counts: Map<string, number>;
}

export interface IMemberContentCounter {
    /**
     * Count this feature's items grouped by creator for the given team + users.
     * @returns the metric key and a userId->count map.
     */
    countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>;
}
