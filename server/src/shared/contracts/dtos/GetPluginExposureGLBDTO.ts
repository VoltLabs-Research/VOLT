/**
 * Neutral, cross-module DTO contract for the get-plugin-exposure-GLB use case.
 *
 * Extracted from `@modules/plugin/dtos/exposure/GetPluginExposureGLBDTO`
 * during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginExposureGLBUseCase` consumes `GetPluginExposureGLBOutputDTO`
 * (and the `IGetPluginExposureGLBUseCase` port returns it). The output aliases
 * the already-neutral `DownloadStreamOutputDTO`. The owner DTO file re-exports
 * these so existing importers compile unchanged. Pure types.
 */
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

export interface GetPluginExposureGLBInputDTO {
    teamId: string;
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: string;
    acceptEncoding?: string;
}

export type GetPluginExposureGLBOutputDTO = DownloadStreamOutputDTO;
