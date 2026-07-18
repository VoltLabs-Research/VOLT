/**
 * Neutral, cross-module DTO contract for the get-plugin-exposure-export use case.
 *
 * Extracted from `@modules/plugin/dtos/exposure/GetPluginExposureExportDTO`
 * during the detachable-modules migration. The trajectory module's
 * `DownloadTrajectoryAnalysesUseCase` drives the export use case via the
 * `IGetPluginExposureExportUseCase` port, whose `execute` signature references
 * these types; hosting them here keeps the port free of `@modules/plugin`. The
 * output aliases the already-neutral `DownloadStreamOutputDTO`. The owner DTO
 * file re-exports these so existing importers compile unchanged. Pure types.
 */
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureExportInputDTO {
    teamId: string;
    analysisId: string;
}

export type GetPluginExposureExportOutputDTO = DownloadStreamOutputDTO;
