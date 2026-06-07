import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

/**
 * Internal helpers shared by generated controllers so request data merging
 * stays in one place.
 */

export const readUserAgent = (req: AuthenticatedRequest): string => {
    const userAgent = req.headers['user-agent'];

    return Array.isArray(userAgent) ? userAgent[0] ?? '' : userAgent ?? '';
};

/**
 * Top-level route param / query-string keys that consuming use-cases type as
 * `number`. Express delivers path params and query params as STRINGS, so we
 * coerce this known set centrally here — this preserves the behaviour that the
 * removed `z.coerce.number()` schemas used to provide. Body fields are NOT
 * touched (JSON already carries proper numbers, and `size`/`value` live nested
 * inside bodies where blanket coercion would be wrong).
 */
const NUMERIC_REQUEST_KEYS = [
    'page',
    'limit',
    'timestep',
    'privatePort',
    'days',
    'range',
    'startValue',
    'endValue',
    'maxValues'
] as const;

const coerceNumericKeys = (source: Record<string, unknown>): Record<string, unknown> => {
    const coerced: Record<string, unknown> = { ...source };

    for (const key of NUMERIC_REQUEST_KEYS) {
        const value = coerced[key];

        if (typeof value === 'string' && value.trim() !== '') {
            const numeric = Number(value);

            if (!Number.isNaN(numeric)) {
                coerced[key] = numeric;
            }
        }
    }

    return coerced;
};

export const buildControllerParams = (
    req: AuthenticatedRequest,
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>
): Record<string, unknown> => {
    const bodyPayload = asRecord(req.body) ?? {};
    const paramsPayload = coerceNumericKeys(asRecord(req.params) ?? {});
    const queryPayload = coerceNumericKeys(asRecord(req.query) ?? {});
    const baseParams: Record<string, unknown> = {
        ...paramsPayload,
        ...queryPayload,
        ...bodyPayload,
        data: bodyPayload,
        userId: req.userId,
        authenticatedUserId: req.userId,
        token: req.token,
        authType: req.authType,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: readUserAgent(req),
        traceId: req.requestContext?.traceId,
        requestContext: req.requestContext
    };

    if (req.file !== undefined) {
        baseParams.file = req.file;
    }

    if (req.files !== undefined) {
        baseParams.files = req.files;
    }

    if (baseParams.secretKeyId === undefined) baseParams.secretKeyId = req.secretKeyId;
    if (baseParams.secretKeyTeamId === undefined) baseParams.secretKeyTeamId = req.secretKeyTeamId;
    if (baseParams.secretKeyRoleId === undefined) baseParams.secretKeyRoleId = req.secretKeyRoleId;

    if (!extendParams) {
        return baseParams;
    }

    return extendParams(req, baseParams);
};
