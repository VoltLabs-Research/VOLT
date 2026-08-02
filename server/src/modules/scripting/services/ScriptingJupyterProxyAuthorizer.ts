import { ErrorCodes } from '@core/constants/error-codes';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import {
    JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME,
    JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    matchJupyterProxyPath,
    PROXY_URL_ORIGIN
} from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { requireTeamMembership } from '@modules/team/services/team/team-membership-guard';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { parse as parseCookie } from 'cookie';

export interface AuthorizedProxyContext {
    teamId: string;
    runtimeNotebookId: string;
    teamClusterId: string;
    userId: string;
}

interface AuthorizedProxyCacheEntry {
    expiresAt: number;
    context: Promise<AuthorizedProxyContext>;
}

const AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS = 30_000;
const REQUIRED_PROXY_PERMISSION = `${Resource.SCRIPTING}:${Action.READ}`;

const readProxyAccessToken = (requestUrl: string, cookieHeader: string | undefined): string | undefined => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);
    const queryToken = url.searchParams.get(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM);
    if (queryToken) {
        return queryToken;
    }

    return cookieHeader ? parseCookie(cookieHeader)[JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME] : undefined;
};

const resolveAuthorizedProxyContext = async (
    teamId: string,
    runtimeNotebookId: string,
    userId: string
): Promise<AuthorizedProxyContext> => {
    const member = await requireTeamMembership(teamId, userId);

    const permissions = member.roleRef?.permissions ?? [];
    if (!permissions.includes('*') && !permissions.includes(REQUIRED_PROXY_PERMISSION)) {
        throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, `Missing permission: ${REQUIRED_PROXY_PERMISSION}`);
    }

    const notebook = await ScriptingNotebook.findOneBy({
        team: teamId,
        runtimeNotebookId
    });

    if (!notebook || !notebook.teamCluster) {
        throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook runtime not found');
    }

    return {
        teamId,
        runtimeNotebookId,
        teamClusterId: notebook.teamCluster,
        userId
    };
};

class ScriptingJupyterProxyAuthorizer {
    private readonly accessTokenService = new ScriptingJupyterAccessTokenService();
    private readonly contextCache = new Map<string, AuthorizedProxyCacheEntry>();

    async authorize(requestUrl: string, cookieHeader: string | undefined): Promise<AuthorizedProxyContext> {
        const match = matchJupyterProxyPath(requestUrl);
        if (!match) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Jupyter proxy route not found');
        }

        const accessToken = readProxyAccessToken(requestUrl, cookieHeader);
        if (!accessToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Authentication is required');
        }

        const verifiedToken = this.accessTokenService.verify(accessToken);
        if (!verifiedToken) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Your session is no longer valid');
        }

        if (verifiedToken.teamId !== match.teamId || verifiedToken.runtimeNotebookId !== match.runtimeNotebookId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'You do not have access to this team');
        }

        const cacheKey = `${verifiedToken.userId}:${match.teamId}:${match.runtimeNotebookId}`;
        const cachedContext = this.readCachedContext(cacheKey);
        if (cachedContext) {
            return cachedContext;
        }

        logger.debug(`Resolving Jupyter proxy authorization context teamId=${match.teamId} runtimeNotebookId=${match.runtimeNotebookId} userId=${verifiedToken.userId}`);

        this.pruneExpiredContextCache();

        const cacheEntry: AuthorizedProxyCacheEntry = {
            expiresAt: Date.now() + AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS,
            context: resolveAuthorizedProxyContext(match.teamId, match.runtimeNotebookId, verifiedToken.userId)
        };

        this.contextCache.set(cacheKey, cacheEntry);

        try {
            const context = await cacheEntry.context;
            cacheEntry.expiresAt = Date.now() + AUTHORIZED_PROXY_CONTEXT_CACHE_TTL_MS;
            return context;
        } catch (error: unknown) {
            this.contextCache.delete(cacheKey);
            throw error;
        }
    }

    private readCachedContext(cacheKey: string): Promise<AuthorizedProxyContext> | undefined {
        const cacheEntry = this.contextCache.get(cacheKey);
        if (!cacheEntry) {
            return undefined;
        }

        if (cacheEntry.expiresAt <= Date.now()) {
            this.contextCache.delete(cacheKey);
            return undefined;
        }

        logger.debug(`Serving cached Jupyter proxy authorization context cacheKey=${cacheKey}`);
        return cacheEntry.context;
    }

    private pruneExpiredContextCache(): void {
        const now = Date.now();

        for (const [cacheKey, cacheEntry] of this.contextCache.entries()) {
            if (cacheEntry.expiresAt <= now) {
                this.contextCache.delete(cacheKey);
            }
        }
    }
}

export default new ScriptingJupyterProxyAuthorizer();
