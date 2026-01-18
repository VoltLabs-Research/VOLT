import { container } from 'tsyringe';
import { SHARED_TOKENS } from './SharedTokens';
import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import FileExtractorService from '@shared/infrastructure/services/FileExtractorService';

/**
 * Register as singleton for reuse client connection.
 */
container.registerSingleton(SHARED_TOKENS.StorageService, MinioStorageService);
container.registerSingleton('IStorageService', MinioStorageService);
container.registerSingleton(SHARED_TOKENS.TempFileService, TempFileService);
container.registerSingleton(SHARED_TOKENS.FileExtractorService, FileExtractorService);