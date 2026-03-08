import { get, download, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { DownloadSampleInputDTO } from '../../../dtos/download-sample';

const endpoints = {
    listSamples: get<EmptyParams, string[]>('/samples'),
    downloadSample: download<DownloadSampleInputDTO>('GET', '/samples/:filename')
};

export default endpoints;
