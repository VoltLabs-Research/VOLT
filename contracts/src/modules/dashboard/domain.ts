// Wire response types for the dashboard module — the shapes the client reads
// back from `data`.

/**
 * Global-search results, grouped by entity type. Each group is a pass-through
 * of the owning module's persisted DTO (analysis / container / trajectory /
 * team / plugin / chat), aggregated here for a single cross-entity search
 * response; the concrete per-item shapes are owned by those modules.
 */
export interface GlobalSearchResponse{
    analyses: Record<string, unknown>[];
    containers: Record<string, unknown>[];
    trajectories: Record<string, unknown>[];
    teams: Record<string, unknown>[];
    plugins: Record<string, unknown>[];
    chats: Record<string, unknown>[];
}
