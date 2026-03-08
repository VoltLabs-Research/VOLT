import { download } from '@/app/core/http/utilities/create-service';
import type { ExportPluginListingInputDTO } from '../../../dtos/listing/export-plugin-listing';
import type { ExportListingByAnalysisInputDTO } from '../../../dtos/listing/export-listing-by-analysis';

const requireExposureSelector = (params: { exposureId?: string; exposureName?: string }, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const endpoints = {
    exportListing: download<ExportPluginListingInputDTO>('GET',
        ({ pluginId, trajectoryId }) => trajectoryId
            ? `/listing/${pluginId}/trajectory/${trajectoryId}/export`
            : `/listing/${pluginId}/export`,
        {
            query: ({ analysisId, exposureId, exposureName, format }) => ({
                ...(analysisId ? { analysisId } : {}),
                ...(exposureId ? { exposureId } : {}),
                ...(exposureName ? { exposureName } : {}),
                format
            }),
            validate: (params) => requireExposureSelector(params, 'Exposure::SelectorRequired')
        }
    ),
    exportListingByAnalysis: download<ExportListingByAnalysisInputDTO>('GET',
        '/listing/analysis/:analysisId/export',
        { query: ({ format }) => ({ format }) }
    )
};

export default endpoints;
