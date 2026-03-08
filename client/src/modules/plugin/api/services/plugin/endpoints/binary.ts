import { del, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../../../dtos/plugin/upload-binary';

interface DeleteBinaryInputDTO {
    pluginId: string;
};

interface UploadProgressEvent {
    loaded: number;
    total?: number;
};

const createUploadProgressHandler = ({ onProgress }: UploadBinaryInputDTO) => {
    let handleProgress: ((event: UploadProgressEvent) => void) | undefined;

    if (onProgress) {
        handleProgress = (event) => {
            if (event.total) {
                onProgress(event.loaded / event.total);
            }
        };
    }

    return handleProgress;
};

const endpoints = {
    uploadBinary: request<UploadBinaryInputDTO, UploadBinaryOutputDTO>('PATCH', '/:pluginId/binary', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: createUploadProgressHandler
    }),
    deleteBinary: del<DeleteBinaryInputDTO>('/:pluginId/binary')
};

export default endpoints;
