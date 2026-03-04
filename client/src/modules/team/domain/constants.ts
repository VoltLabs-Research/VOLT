export const SECRET_KEY_ROUTES = {
    LIST: '/dashboard/secret-keys',
    METRICS: '/dashboard/secret-keys/metrics',
    USAGE: (secretKeyId: string) => `/dashboard/secret-keys/${secretKeyId}/usage`
} as const;
