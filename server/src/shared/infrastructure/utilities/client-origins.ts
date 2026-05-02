const STANDARD_PORTS = new Set(['80', '443']);
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'];

const inferTunnelPort = (origin: string): string | null => {
    const url = new URL(origin);

    if (url.port && !STANDARD_PORTS.has(url.port)) {
        return url.port;
    }

    const hostname = url.hostname.toLowerCase();
    const codespacesMatch = hostname.match(/-(\d+)\.app\.github\.dev$/i);
    if (codespacesMatch?.[1]) {
        return codespacesMatch[1];
    }

    const coderMatch = hostname.match(/^(\d+)--.+\.try\.coder\.app$/i);
    if (coderMatch?.[1]) {
        return coderMatch[1];
    }

    return null;
};

const expandLoopbackAliases = (origin: string): string[] => {
    const port = inferTunnelPort(origin);
    if (!port) {
        return [];
    }

    const aliases = new Set<string>();
    for (const protocol of ['http:', 'https:']) {
        for (const hostname of LOOPBACK_HOSTS) {
            aliases.add(`${protocol}//${hostname}:${port}`);
        }
    }

    return Array.from(aliases);
};

export const normalizeOrigin = (value: string): string | null => {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
};

export const collectAllowedClientOrigins = (origins: Array<string | null | undefined>): string[] => {
    const allowedOrigins = new Set<string>();

    for (const rawOrigin of origins) {
        if (!rawOrigin?.trim()) {
            continue;
        }

        // Split on whitespace and commas so a single env var can carry several
        // origins (e.g. CLIENT_HOST="http://localhost:5273,http://1.2.3.4:5273").
        const tokens = rawOrigin
            .split(/[,\s]+/)
            .map((token) => token.trim())
            .filter(Boolean);

        for (const token of tokens) {
            const normalizedOrigin = normalizeOrigin(token);
            if (!normalizedOrigin) {
                continue;
            }

            allowedOrigins.add(normalizedOrigin);

            for (const alias of expandLoopbackAliases(normalizedOrigin)) {
                allowedOrigins.add(alias);
            }
        }
    }

    return Array.from(allowedOrigins);
};
