import { del, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../../../dtos/plugin/upload-binary';

const endpoints = {
    uploadBinary: request<UploadBinaryInputDTO, UploadBinaryOutputDTO>('PATCH', '/:pluginId/binary', {
        body: ({ file }) => buildFileFormData([{ name: 'file', file }]),
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: ({ onProgress }) => onProgress
            ? (e) => {
                if (e.total) {
                    onProgress(e.loaded / e.total);
                }
            }
            : undefined
    }),
    deleteBinary: del<{ pluginId: string }>('/:pluginId/binary')
};

export default endpoints;
