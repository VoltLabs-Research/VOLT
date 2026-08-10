import type { JsonObject } from '@shared/contracts/types/json';

export interface WorkflowExposureInspectionResult {
    outputFilePath: string;
    listingRowCount: number;
    subListingNames: string[];
    exportPayload: JsonObject | null;
}
