import { existsSync } from 'node:fs';
import path from 'node:path';

export const assertDevPaths = (voltPath: string) => {
    if(!path.isAbsolute(voltPath)) throw new Error(`VOLT path must be absolute (got ${voltPath || 'empty'})`);

    const checks: [string, string][] = [
        [path.join(voltPath, 'server', 'Dockerfile.dev'), `VOLT path must contain server/Dockerfile.dev (got ${voltPath})`],
        [path.join(voltPath, 'client'), `VOLT path must contain a client/ directory (got ${voltPath})`],
        [path.join(voltPath, 'cluster', 'Dockerfile.dev'), `VOLT path must contain cluster/Dockerfile.dev (got ${voltPath})`]
    ];

    for(const [target, message] of checks){
        if(!existsSync(target)) throw new Error(message);
    }
};
