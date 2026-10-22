// Files installed on the machine a backend runs on besides the backend itself, where an install on a
// computer has them: npm packages in the global folder Node's require searches ($PREFIX/lib/node),
// which the daemon's analysis plugins load DuckDB from, the tools in the daemon's vendor/ (zstd,
// volt-dump-transform), and python3's Pyodide and wheels. Each is a directory scripts/build.mjs writes
// next to the runtime's workers, with an install.json saying where it is installed and what it holds.
import path from 'path';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from './fs';

interface InstallManifest {
    target: string;
    files: string[];
    // The digest of its files: an install that has it is current.
    version: string;
}

// Written last, so an install interrupted midway is redone. It lists the files of the version
// installed, so that the next version removes the ones it no longer has.
const STAMP = '.volt-install';

type InstallStamp = Pick<InstallManifest, 'version' | 'files'>;

const readStamp = (stamp: string): InstallStamp | null => {
    if(!existsSync(stamp)){
        return null;
    }
    const text = String(readFileSync(stamp, 'utf8'));
    try{
        const parsed = JSON.parse(text) as InstallStamp | null;
        if(parsed && typeof parsed === 'object'){
            return parsed;
        }
    }catch{
        // A runtime that stamped the version alone.
    }
    return { version: text, files: [] };
};

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
            const installed = readStamp(stamp);
            if(installed?.version !== manifest.version){
                for(const file of manifest.files){
                    const target = path.join(manifest.target, file);
                    mkdirSync(path.dirname(target), { recursive: true });
                    writeFileSync(target, await fetchFile(source, file));
                }
                for(const file of installed?.files ?? []){
                    if(!manifest.files.includes(file)){
                        rmSync(path.join(manifest.target, file), { force: true });
                    }
                }
                writeFileSync(stamp, JSON.stringify({ version: manifest.version, files: manifest.files }));
            }
            return manifest.target;
        })();
        installs.set(source, installing);
    }
    return installing;
};

// Where the build puts a global npm package's install.
export const globalPackageSource = (name: string): string => `node/${name}`;
