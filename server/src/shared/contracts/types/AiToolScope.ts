/**
 * Neutral scope passed to every AI tool when building its tool-set for a
 * request. Lives in `shared/contracts` so the neutral `AITool` base class and
 * every feature module's tools can reference it without importing `@modules/ai`.
 * The AI module's `AIToolService` re-exports this for backward compatibility.
 */
export interface AIToolScope {
    teamId: string;
    userId: string;
}
