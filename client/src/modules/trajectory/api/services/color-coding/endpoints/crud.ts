import { get, post } from '@/app/core/http/utilities/create-service';
import type { ApplyColorCodingInputDTO } from '../../../dtos/apply-color-coding';
import type { GetColorCodingPropertiesInputDTO, ColorCodingProperties } from '../../../dtos/get-color-coding-properties';
import type { GetColorCodingStatsInputDTO, ColorCodingStats } from '../../../dtos/get-color-coding-stats';

const endpoints = {
    getProperties: get<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/properties/${trajectoryId}/${analysisId}`
            : `/properties/${trajectoryId}`,
        { query: ({ timestep }) => ({ timestep }) }
    ),
    getStats: get<GetColorCodingStatsInputDTO, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/stats/${trajectoryId}/${analysisId}`
            : `/stats/${trajectoryId}`,
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

export default endpoints;
