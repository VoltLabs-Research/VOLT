/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/IAnalysisRepository`) for the detachable-modules
 * migration. Re-exported here so existing importers of this module path keep
 * compiling unchanged.
 */
export type {
    IAnalysisRepository,
    AnalysisRuntimeTarget,
    AnalysisTeamSearchOptions
} from '@shared/contracts/ports/IAnalysisRepository';
