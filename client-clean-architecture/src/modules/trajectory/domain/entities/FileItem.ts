export interface FileItem {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    path: string;
}

export interface FsListResponse {
    files: FileItem[];
    currentPath: string;
}
