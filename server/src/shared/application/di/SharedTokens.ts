export const SHARED_TOKENS = {
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    FileExtractorService: Symbol.for('FileExtractorService')
} as const;
