// npm packages installed on the machine a backend runs on, in a global folder Node's require
// searches ($PREFIX/lib/node), as packages installed on a computer are found by the programs it runs:
// the daemon's analysis plugins load DuckDB from there. Each is a copy scripts/build.mjs makes of the
// package (its CommonJS entry bundled with its dependencies), served next to the runtime's workers.
import path from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from './fs';

export const GLOBAL_MODULES = '/usr/local/lib/node';

// The files each package has; its package.json is written last, marking the install complete.
export const GLOBAL_PACKAGES = {
    '@duckdb/duckdb-wasm': ['dist/duckdb-node-blocking.cjs', 'dist/duckdb-mvp.wasm', 'dist/duckdb-eh.wasm', 'package.json']
} as const;

export type GlobalPackage = keyof typeof GLOBAL_PACKAGES;

const fetchFile = async (name: string, file: string): Promise<Uint8Array> => {
    const response = await fetch(new URL(`./node/${name}/${file}`, import.meta.url));
    if(!response.ok){
        throw new Error(`${name}: could not load ${file} (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
};

const installedVersion = (name: GlobalPackage): string | null => {
    const manifest = path.join(GLOBAL_MODULES, name, 'package.json');
    return existsSync(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8') as string) as { version: string }).version : null;
};

const installs = new Map<GlobalPackage, Promise<string>>();

// Installs the package unless this version already is; resolves its directory.
export const installGlobalPackage = (name: GlobalPackage): Promise<string> => {
    let install = installs.get(name);
    if(!install){
        install = (async () => {
            const directory = path.join(GLOBAL_MODULES, name);
            const manifest = await fetchFile(name, 'package.json');
            const { version } = JSON.parse(new TextDecoder().decode(manifest)) as { version: string };
            if(installedVersion(name) !== version){
                for(const file of GLOBAL_PACKAGES[name]){
                    const target = path.join(directory, file);
                    mkdirSync(path.dirname(target), { recursive: true });
                    writeFileSync(target, file === 'package.json' ? manifest : await fetchFile(name, file));
                }
            }
            return directory;
        })();
        installs.set(name, install);
    }
    return install;
};
