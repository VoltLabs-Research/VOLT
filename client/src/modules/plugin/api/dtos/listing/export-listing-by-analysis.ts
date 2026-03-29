import type { ExportType } from '@/shared/domain/export/types';

export interface ExportListingByAnalysisInputDTO {
    analysisId: string;
    format: ExportType;
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
};
