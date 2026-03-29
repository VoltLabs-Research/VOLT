import { download, get } from '@/app/core/http/utilities/create-service';
import type { ExportPluginListingInputDTO } from '../../../dtos/listing/export-plugin-listing';
import type { ExportListingByAnalysisInputDTO } from '../../../dtos/listing/export-listing-by-analysis';
import type { GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO } from '../../../dtos/listing/get-analysis-listing-export-options';

interface ExposureSelectorParams {
    exposureId?: string;
    exposureName?: string;
};

const requireExposureSelector = (params: ExposureSelectorParams, message: string) => {
    if (!params.exposureId && !params.exposureName) {
        throw new Error(message);
    }
};

const buildExportListingPath = ({ pluginId, trajectoryId }: ExportPluginListingInputDTO) => {
    let path = `/${pluginId}/listings/export`;

    if (trajectoryId) {
        path = `/${pluginId}/listings/trajectories/${trajectoryId}/export`;
    }

    return path;
};

const endpoints = {
    getAnalysisListingExportOptions: get<GetAnalysisListingExportOptionsInputDTO, GetAnalysisListingExportOptionsOutputDTO>(
        '/listings/analyses/:analysisId/export/options'
    ),
    exportListing: download<ExportPluginListingInputDTO>('GET',
        buildExportListingPath,
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
        '/listings/analyses/:analysisId/export',
        {
            query: ({ format, includeConfig, selectedListingIds, selectedSubListingIds }) => ({
                format,
                ...(includeConfig !== undefined ? { includeConfig } : {}),
                ...(selectedListingIds
                    ? { selectedListingIds: selectedListingIds.join(',') }
                    : {}),
                ...(selectedSubListingIds
                    ? { selectedSubListingIds: selectedSubListingIds.join(',') }
                    : {})
            })
        }
    )
};

export default endpoints;
