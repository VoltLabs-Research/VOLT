import { download, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { Plugin } from '../../../entities/plugin';
import type { ExportPluginInputDTO } from '../../../dtos/plugin/export-plugin';
import type { ExportAnalysisResultsInputDTO } from '../../../dtos/plugin/export-analysis-results';
import type { ImportPluginInputDTO } from '../../../dtos/plugin/import-plugin';

const endpoints = {
    exportPlugin: download<ExportPluginInputDTO>('GET', '/:_id/export'),
    exportAnalysisResults: download<ExportAnalysisResultsInputDTO>('GET', '/listings/analyses/:analysisId/export'),
    importPlugin: request<ImportPluginInputDTO, Plugin>('POST', '/import', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

export default endpoints;
