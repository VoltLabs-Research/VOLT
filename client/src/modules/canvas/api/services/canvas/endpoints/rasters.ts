import { get } from '@/app/core/http/utilities/create-service';
import type {
    GetRasterMetadataParams,
    GetRasterMetadataResponse
} from '@/modules/raster/api/dtos';

export default {
    getRasterMetadata: get<GetRasterMetadataParams, GetRasterMetadataResponse>('/:trajectoryId/raster-metadata')
};
