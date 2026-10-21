import { promises } from './fs';

export const {
    access,
    appendFile,
    chmod,
    chown,
    copyFile,
    cp,
    lstat,
    mkdir,
    mkdtemp,
    open,
    readFile,
    readdir,
    readlink,
    realpath,
    rename,
    rm,
    rmdir,
    stat,
    symlink,
    truncate,
    unlink,
    utimes,
    writeFile,
    constants
} = promises;

export default promises;
