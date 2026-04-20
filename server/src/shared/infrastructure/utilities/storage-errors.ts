interface StorageObjectErrorLike {
    code?: string;
    statusCode?: number;
};

export const isStorageObjectNotFoundError = (error: unknown): error is StorageObjectErrorLike => {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const candidate = error as StorageObjectErrorLike;
    return candidate.code === 'NotFound'
        || candidate.code === 'NoSuchKey'
        || candidate.statusCode === 404;
};
