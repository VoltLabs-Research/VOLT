// fs.constants, with Linux's values: also what process.binding('constants').fs reports.
export const constants = {
    F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
    O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128, O_NOCTTY: 256, O_TRUNC: 512, O_APPEND: 1024,
    O_DIRECTORY: 65536, O_NOFOLLOW: 131072, O_SYNC: 1052672, O_DSYNC: 4096,
    S_IFMT: 0o170000, S_IFREG: 0o100000, S_IFDIR: 0o040000, S_IFLNK: 0o120000,
    S_IRUSR: 0o400, S_IWUSR: 0o200, S_IXUSR: 0o100,
    COPYFILE_EXCL: 1, COPYFILE_FICLONE: 2, COPYFILE_FICLONE_FORCE: 4, UV_FS_O_FILEMAP: 0
};
