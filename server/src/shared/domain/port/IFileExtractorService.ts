export interface ExtractedFile {
    path: string;
    originalname: string;
    size: number;
    mimetype?: string;
}

export interface UploadedFile {
    path?: string;
    size: number;
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
}

export interface IFileExtractorService {
    /**
     * Extracts uploaded files (single or ZIP) to a working directory.
     * Returns a list of valid extracted files.
     */
    extractFiles(files: UploadedFile[], workingDir: string): Promise<ExtractedFile[]>;

    /**
     * Recursively gets all files in a directory.
     */
    getFilesRecursive(dir: string): Promise<string[]>;
}
