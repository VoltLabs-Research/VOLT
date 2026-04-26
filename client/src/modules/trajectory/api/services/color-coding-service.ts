import { createService, get, post } from '@/app/core/http/utilities/create-service';

import type {
    ApplyColorCodingInputDTO,
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '../dtos/color-coding';

const endpoints = {
    getProperties: get<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/properties/${analysisId}`
            : `/${trajectoryId}/properties`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    getStats: get<GetColorCodingStatsInputDTO, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/stats/${analysisId}`
            : `/${trajectoryId}/stats`,
        { omit: ['trajectoryId', 'analysisId'] }
    ),
    apply: post<ApplyColorCodingInputDTO, void>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/${analysisId}`
            : `/${trajectoryId}`,
        {
            body: ({ timestep, payload }) => ({ ...payload, timestep: String(timestep) }),
            unwrap: 'void'
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/color-codings',
            useRBAC: true
        }
    }
}, endpoints);
