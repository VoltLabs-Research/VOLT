import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export const getAuthRequestContext = (request: AuthenticatedRequest) => {
    const userAgentHeader = request.headers['user-agent'];

    return {
        ip: request.ip || request.socket.remoteAddress || '',
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] ?? '' : userAgentHeader ?? ''
    };
};
