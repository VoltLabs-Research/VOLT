import { container } from 'tsyringe';
import { SHARED_TOKENS } from './SharedTokens';
import MinioStorageService from '../services/MinioStorageService';

/**
 * Register as singleton for reuse client connection.
 */
container.registerSingleton(SHARED_TOKENS.StorageService, MinioStorageService);