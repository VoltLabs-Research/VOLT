import { authRoutes } from '@volt/contracts/modules/auth/routes';
import { buildPath } from '@volt/contracts/shared/routing';

export const isUp = async (url: string): Promise<boolean> => {
    try{
        const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        return res.ok || res.status === 404;
    }catch{
        return false;
    }
};

export const PROBE_PATH = buildPath(authRoutes.checkEmail, { email: 'probe@volt.local' });

export const webProbeUrl = (env: Record<string, string>): string =>
    `http://localhost:${env.WEB_PORT ?? '5273'}${PROBE_PATH}`;
