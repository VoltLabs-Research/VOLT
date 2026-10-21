// Node's `path`: path-browserify is the posix implementation, and has no `win32`. Libraries read
// Windows paths even on Linux (tar strips drive letters and UNC roots from archive entries), so
// win32 provides the parsing half of Node's: roots, absoluteness and the parts of a path.
import posix from 'path-browserify';

interface ParsedPath {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
}

// A UNC root (\\server\share\), a drive (C: or C:\), or a single separator.
const WIN32_ROOT = /^(?:[\\/]{2}[^\\/]+[\\/]+[^\\/]+[\\/]?|[a-zA-Z]:[\\/]?|[\\/])/;
const WIN32_TRAILING_SEPARATORS = /[\\/]+$/;

const win32Root = (path: string): string => WIN32_ROOT.exec(path)?.[0] ?? '';

const win32Parse = (path: string): ParsedPath => {
    const root = win32Root(path);
    const rest = path.slice(root.length).replace(WIN32_TRAILING_SEPARATORS, '');
    const separator = Math.max(rest.lastIndexOf('\\'), rest.lastIndexOf('/'));
    const base = rest.slice(separator + 1);
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 && base !== '..' ? base.slice(dot) : '';
    return {
        root,
        dir: separator === -1 ? (base ? root : root || '') : root + rest.slice(0, separator),
        base,
        ext,
        name: ext ? base.slice(0, -ext.length) : base
    };
};

const win32 = {
    sep: '\\',
    delimiter: ';',
    isAbsolute: (path: string): boolean => /^(?:[\\/]|[a-zA-Z]:[\\/])/.test(path),
    parse: win32Parse,
    // Unlike parse(), Node's basename only sets a drive aside: a UNC share is the last segment.
    basename: (path: string, suffix?: string): string => {
        const base = path.replace(/^[a-zA-Z]:/, '').replace(WIN32_TRAILING_SEPARATORS, '').split(/[\\/]/).pop() ?? '';
        return suffix && base.endsWith(suffix) && base !== suffix ? base.slice(0, -suffix.length) : base;
    },
    dirname: (path: string): string => win32Parse(path).dir || '.',
    extname: (path: string): string => win32Parse(path).ext
};

const path = Object.assign({}, posix, { posix, win32 });

export default path;
