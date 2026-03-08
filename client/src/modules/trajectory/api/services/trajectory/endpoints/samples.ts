import { get, download } from '@/app/core/http/utilities/create-service';
import type { DownloadSampleInputDTO } from '../../../dtos/trajectory';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';

export default {
    listSamples: get<EmptyParams, string[]>('/samples'),
    downloadSample: download<DownloadSampleInputDTO>('GET', '/samples/:filename')
};
