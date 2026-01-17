import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import { inject, injectable } from 'tsyringe';
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import { IStorageService } from "@/src/shared/domain/ports/IStorageService";
import { UploadChatFileInputDTO, UploadChatFileOutputDTO } from "../../dtos/chat/UploadChatFileDTO";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { SYS_BUCKETS } from "@/src/core/minio";
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

@injectable()
export default class UploadChatFileUseCase implements IUseCase<UploadChatFileInputDTO, UploadChatFileOutputDTO, ApplicationError>{
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,
    ){}

    async execute(input: UploadChatFileInputDTO): Promise<Result<UploadChatFileOutputDTO, ApplicationError>>{
        try{
            const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(input.originalName)}`;
            const objectName = `chat-files/${uniqueName}`;

            await this.storageService.upload(
                SYS_BUCKETS.CHAT,
                objectName,
                input.buffer,
                {
                    'Content-Type': input.mimetype
                }
            );

            const fileUrl = `/api/chat/files/${uniqueName}`;

            return Result.ok({
                filename: uniqueName,
                originalName: input.originalName,
                size: input.size,
                mimetype: input.mimetype,
                url: fileUrl
            });
        } catch(error: any){
            return Result.fail(
                new ApplicationError(
                    'FILE_UPLOAD_FAILED',
                    `Failed to upload file: ${error.message}`,
                    500
                )
            );
        }
    }
};
