import type { AnalysisProps } from '@shared/contracts/types/AnalysisProps';
import type { PaginatedResult } from '@shared/domain/port/persistence';
interface GetAnalysesByTrajectoryItemView extends Omit<AnalysisProps, 'plugin'> {
    _id: string;
    plugin: string;
    pluginDisplayName: string;
}

export interface GetAnalysesByTrajectoryIdOutput extends PaginatedResult<GetAnalysesByTrajectoryItemView> {}
