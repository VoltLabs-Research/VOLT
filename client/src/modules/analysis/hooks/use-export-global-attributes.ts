import { triggerBrowserDownload } from '@/shared/utils/file';
import service from '../api/global-attributes-service';

export const exportGlobalAttributesCsv = async (analysisId: string): Promise<void> => {
    const blob = await service.exportCsv({ analysisId });
    triggerBrowserDownload(blob, `global-attributes-${analysisId}.csv`);
};
