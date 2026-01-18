import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import { inject, injectable } from 'tsyringe';
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import { IStorageService } from "@/src/shared/domain/ports/IStorageService";
import { GetChatFileInputDTO, GetChatFileOutputDTO } from "../../dtos/chat/GetChatFileDTO";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { SYS_BUCKETS } from "@/src/core/config/minio";

@injectable()
export default class GetChatFileUseCase implements IUseCase<GetChatFileInputDTO, GetChatFileOutputDTO, ApplicationError>{
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,
    ){}

    async execute(input: GetChatFileInputDTO): Promise<Result<GetChatFileOutputDTO, ApplicationError>>{
        try{
            const objectName = `chat-files/${input.filename}`;

            const exists = await this.storageService.exists(SYS_BUCKETS.CHAT, objectName);

            if(!exists){
                return Result.fail(
                    new ApplicationError('FILE_NOT_FOUND', 'File not found', 404)
                );
            }

            const stat = await this.storageService.getStat(SYS_BUCKETS.CHAT, objectName);
            const stream = await this.storageService.getStream(SYS_BUCKETS.CHAT, objectName);

            const contentType = stat.mimetype || 'application/octet-stream';
            const isImage = contentType.startsWith('image/');

            return Result.ok({
                stream,
                metadata: {
                    contentType,
                    size: stat.size,
                    disposition: isImage ? 'inline' : 'attachment',
                    filename: isImage ? undefined : input.filename
                }
            });
        } catch(error: any){
            return Result.fail(
                new ApplicationError(
                    'FILE_RETRIEVAL_FAILED',
                    `Failed to retrieve file: ${error.message}`,
                    500
                )
            );
        }
    }
};
