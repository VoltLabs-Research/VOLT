import { get } from '@/app/core/http/utilities/create-service';
import type {
    ColorCodingProperties,
    ColorCodingStats,
    GetColorCodingPropertiesInputDTO,
    GetColorCodingStatsInputDTO
} from '@/modules/trajectory/api/dtos/color-coding';

export default {
    getColorCodingProperties: get<GetColorCodingPropertiesInputDTO, ColorCodingProperties>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/properties/${analysisId}`
            : `/${trajectoryId}/color-coding/properties`,
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep }) => ({ timestep })
        }
    ),
    getColorCodingStats: get<GetColorCodingStatsInputDTO, ColorCodingStats>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/color-coding/stats/${analysisId}`
            : `/${trajectoryId}/color-coding/stats`,
        {
            omit: ['trajectoryId', 'analysisId']
        }
    )
};
