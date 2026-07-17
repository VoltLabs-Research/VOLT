import { buildKeys, createQuery } from '@/shared/query';
import lineStyleService from '@/modules/trajectory/api/services/line-style-service';

import type {
    GetLineModelRangesInput,
    GetLineModelRangesResponse
} from '@/modules/trajectory/api/services/line-style-service';

const KEYS = buildKeys<{
    lineModelRanges: GetLineModelRangesInput;
}>('line-style');

export const lineModelRangesQuery = createQuery<GetLineModelRangesInput, GetLineModelRangesResponse>(
    KEYS.lineModelRanges,
    (params) => lineStyleService.getRanges(params)
);
