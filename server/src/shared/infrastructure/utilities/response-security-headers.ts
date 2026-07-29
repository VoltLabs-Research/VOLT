import { collectAllowedClientOrigins } from '@shared/infrastructure/utilities/client-origins';
import type { IncomingHttpHeaders } from 'node:http';
import type { Response } from 'express';

const buildFrameAncestorsDirective = (): string => {
    const frameAncestors = new Set<string>(['\'self\'']);

    for (const origin of collectAllowedClientOrigins([process.env.CLIENT_HOST, process.env.CLIENT_DEV_HOST])) {
        frameAncestors.add(origin);
    }

    return `frame-ancestors ${Array.from(frameAncestors).join(' ')}`;
};

const rewriteFrameAncestorsDirective = (contentSecurityPolicy?: string): string => {
    const frameAncestorsDirective = buildFrameAncestorsDirective();
    if (!contentSecurityPolicy?.trim()) {
        return frameAncestorsDirective;
    }

    const directives = contentSecurityPolicy
        .split(';')
        .map((directive) => directive.trim())
        .filter(Boolean)
        .filter((directive) => !directive.toLowerCase().startsWith('frame-ancestors'));

    directives.push(frameAncestorsDirective);
    return directives.join('; ');
};

export const applyEmbeddableHeadersToProxyResponse = (headers: IncomingHttpHeaders): void => {
    const upstreamContentSecurityPolicy = Array.isArray(headers['content-security-policy'])
        ? headers['content-security-policy'][0]
        : headers['content-security-policy'];

    headers['content-security-policy'] = rewriteFrameAncestorsDirective(upstreamContentSecurityPolicy);
    delete headers['x-frame-options'];
};

export const applyEmbeddableHeadersToResponse = (res: Response, upstreamContentSecurityPolicy?: string): void => {
    res.removeHeader('x-frame-options');
    res.removeHeader('content-security-policy');
    res.setHeader('Content-Security-Policy', rewriteFrameAncestorsDirective(upstreamContentSecurityPolicy));
};
