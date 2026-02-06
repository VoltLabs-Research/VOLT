export const SHARED_TOKENS = {
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    RedisBlockingClient: Symbol.for('RedisBlockingClient'),
    FileExtractorService: Symbol.for('FileExtractorService')
};