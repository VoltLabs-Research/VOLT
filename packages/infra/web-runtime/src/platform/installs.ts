// Files installed on the machine a backend runs on besides the backend itself, where an install on a
// computer has them: npm packages in the global folder Node's require searches ($PREFIX/lib/node),
// which the daemon's analysis plugins load DuckDB from, and the tools in the daemon's vendor/ (zstd,
// volt-dump-transform). Each is a directory scripts/build.mjs writes next to the runtime's workers,
// with an install.json saying where it is installed and what it holds.
import path from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from './fs';

interface InstallManifest {
    target: string;
    files: string[];
    // The digest of its files: an install that has it is current.
    version: string;
}

// Written last, so an install interrupted midway is redone.
const STAMP = '.volt-install';

const fetchFile = async (source: string, file: string): Promise<Uint8Array> => {
    const response = await fetch(new URL(`./${source}/${file}`, import.meta.url));
    if(!response.ok){
        throw new Error(`${source}: could not load ${file} (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
};

const installs = new Map<string, Promise<string>>();

// Installs the directory of the runtime's dist unless its version already is; resolves where.
export const install = (source: string): Promise<string> => {
    let installing = installs.get(source);
    if(!installing){
        installing = (async () => {
            const manifest = JSON.parse(new TextDecoder().decode(await fetchFile(source, 'install.json'))) as InstallManifest;
            const stamp = path.join(manifest.target, STAMP);
            if(!existsSync(stamp) || readFileSync(stamp, 'utf8') !== manifest.version){
                for(const file of manifest.files){
                    const target = path.join(manifest.target, file);
                    mkdirSync(path.dirname(target), { recursive: true });
                    writeFileSync(target, await fetchFile(source, file));
                }
                writeFileSync(stamp, manifest.version);
            }
            return manifest.target;
        })();
        installs.set(source, installing);
    }
    return installing;
};

// Where the build puts a global npm package's install.
export const globalPackageSource = (name: string): string => `node/${name}`;
