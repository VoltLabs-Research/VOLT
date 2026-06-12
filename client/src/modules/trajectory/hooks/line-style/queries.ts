import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import lineStyleService from '@/modules/trajectory/api/services/line-style-service';

import type {
    GetLineModelRangesInputDTO,
    GetLineModelRangesOutputDTO
} from '@/modules/trajectory/api/services/line-style-service';

const KEYS = buildKeys<{
    lineModelRanges: GetLineModelRangesInputDTO;
}>('line-style');

export const lineModelRangesQuery = createQuery<GetLineModelRangesInputDTO, GetLineModelRangesOutputDTO>(
    KEYS.lineModelRanges,
    (params) => lineStyleService.getRanges(params)
);
