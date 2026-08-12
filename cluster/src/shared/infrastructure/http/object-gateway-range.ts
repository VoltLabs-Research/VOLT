import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface ObjectByteRange {
    start: number;
    end: number;
    length: number;
}

const invalidRange = (message: string): ApplicationError =>
    new ApplicationError(ErrorCodes.OBJECT_GATEWAY_INVALID_RANGE, message, 416);

export const parseRangeHeader = (value: string | undefined, objectSize: number): ObjectByteRange | null => {
    if (!value) {
        return null;
    }

    const match = value.match(/^bytes=(\d*)-(\d*)$/i);
    if (!match) {
        throw invalidRange('Range header must use the form bytes=start-end');
    }

    const [, rawStart, rawEnd] = match;

    if (!rawStart && !rawEnd) {
        throw invalidRange('Range header must include a start or end offset');
    }

    if (!rawStart) {
        const suffixLength = Number(rawEnd);
        if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
            throw invalidRange('Range suffix length must be a positive integer');
        }

        const boundedLength = Math.min(suffixLength, objectSize);
        return {
            start: Math.max(0, objectSize - boundedLength),
            end: objectSize - 1,
            length: boundedLength
        };
    }

    const start = Number(rawStart);
    const requestedEnd = rawEnd ? Number(rawEnd) : objectSize - 1;

    if (!Number.isInteger(start) || start < 0 || !Number.isInteger(requestedEnd) || requestedEnd < start) {
        throw invalidRange('Range header contains invalid byte offsets');
    }

    if (start >= objectSize) {
        throw new ApplicationError(ErrorCodes.OBJECT_GATEWAY_RANGE_NOT_SATISFIABLE, 'Range start exceeds object size', 416);
    }

    const end = Math.min(requestedEnd, objectSize - 1);

    return {
        start,
        end,
        length: end - start + 1
    };
};
