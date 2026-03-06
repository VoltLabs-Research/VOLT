export interface TempFileOptions{
    prefix?: string;
    extension?: string;
    subdir?: string;
};

export interface DeleteOptions{
    recursive?: boolean;
    force?: boolean;
};

export interface ITempFileService{
    readonly rootPath: string;

    ensureDir(dirPath: string): Promise<void>;
    generateFilePath(options?: TempFileOptions): string;
    getDirPath(subdir: string): string;

    delete(
        targetPath: string,
        options?: DeleteOptions
    ): Promise<boolean>;
};