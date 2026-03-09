import { createMinioClient } from '@core/config/minio';
import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';
import type { MinioClientConfig } from '@core/config/minio';

export default class ConfiguredMinioStorageService extends MinioStorageService {
    constructor(config: MinioClientConfig) {
        super(createMinioClient(config), config);
    }
};
