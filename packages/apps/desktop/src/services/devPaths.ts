import { existsSync } from 'node:fs';
import path from 'node:path';

export const assertDevPaths = (voltPath: string) => {
    if(!path.isAbsolute(voltPath)) throw new Error(`VOLT path must be absolute (got ${voltPath || 'empty'})`);

    const checks: [string, string][] = [
        [path.join(voltPath, 'packages', 'infra', 'server', 'Dockerfile.dev'), `VOLT path must contain packages/infra/server/Dockerfile.dev (got ${voltPath})`],
        [path.join(voltPath, 'packages', 'apps', 'client'), `VOLT path must contain a packages/apps/client/ directory (got ${voltPath})`],
        [path.join(voltPath, 'packages', 'infra', 'cluster', 'Dockerfile'), `VOLT path must contain packages/infra/cluster/Dockerfile (got ${voltPath})`]
    ];

    for(const [target, message] of checks){
        if(!existsSync(target)) throw new Error(message);
    }
};
