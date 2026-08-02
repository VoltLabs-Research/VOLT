import type { TeamClusterObjectGatewayHeadResponse } from '@shared/contracts/types/TeamClusterObjectGateway';
import type { Request, Response } from 'express';

/**
 * The HTTP conventions shared by the two object surfaces of this module: the
 * signed-URL object endpoints and the daemon-to-daemon object store proxy.
 */

export const readContentLength = (request: Request): number | undefined => {
    const rawContentLength = request.header('content-length');
    return rawContentLength ? Number(rawContentLength) : undefined;
};

export const applyObjectHeaders = (
    response: Response,
    head: TeamClusterObjectGatewayHeadResponse
): void => {
    if (head.contentLength !== undefined) {
        response.setHeader('content-length', String(head.contentLength));
    }

    if (head.contentType) {
        response.setHeader('content-type', head.contentType);
    }

    if (head.contentEncoding) {
        response.setHeader('content-encoding', head.contentEncoding);
    }

    if (head.etag) {
        response.setHeader('etag', head.etag);
    }

    if (head.lastModified) {
        response.setHeader('last-modified', head.lastModified.toUTCString());
    }
};

/** Range support is decided by the upstream object store, so it is passed through. */
export const applyRangeHeaders = (
    response: Response,
    headers: Record<string, string> | undefined
): void => {
    const acceptRanges = headers?.['accept-ranges'];
    if (acceptRanges) {
        response.setHeader('accept-ranges', acceptRanges);
    }

    const contentRange = headers?.['content-range'];
    if (contentRange) {
        response.setHeader('content-range', contentRange);
    }
};

export const isPartialContent = (headers: Record<string, string> | undefined): boolean => {
    return Boolean(headers?.['content-range']);
};

/**
 * These handlers stream, so they answer outside the global error middleware and
 * have to shape the error body themselves.
 */
export const sendObjectError = (
    response: Response,
    error: unknown,
    fallback: { code: string; message: string }
): void => {
    const applicationError = error as { statusCode?: number; code?: string } | null;

    response.status(applicationError?.statusCode ?? 500).json({
        status: 'error',
        code: applicationError?.code ?? fallback.code,
        message: error instanceof Error ? error.message : fallback.message
    });
};
