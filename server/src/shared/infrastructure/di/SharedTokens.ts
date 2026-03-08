export const SHARED_TOKENS = Object.freeze({
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    FileExtractorService: Symbol.for('FileExtractorService')
});
