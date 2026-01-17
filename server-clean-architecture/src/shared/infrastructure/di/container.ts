import { container } from 'tsyringe';
import { SHARED_TOKENS } from './SharedTokens';
import MinioStorageService from '../services/MinioStorageService';
import TempFileService from '../services/TempFileService';
import FileExtractorService from '../services/FileExtractorService';

/**
 * Register as singleton for reuse client connection.
 */
container.registerSingleton(SHARED_TOKENS.StorageService, MinioStorageService);
container.registerSingleton('IStorageService', MinioStorageService);
container.registerSingleton(SHARED_TOKENS.TempFileService, TempFileService);
container.registerSingleton(SHARED_TOKENS.FileExtractorService, FileExtractorService);