import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { inject, injectable } from "tsyringe";
import { GetFilePreviewInputDTO, GetFilePreviewOutputDTO } from "../../dtos/chat-message/GetFilePreviewDTO";
import { IChatMessageRepository } from "../../../domain/port/IChatMessageRepository";
import { IStorageService } from "@/src/shared/domain/ports/IStorageService";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { SYS_BUCKETS } from "@/src/core/minio";
import { CHAT_TOKENS } from "../../../infrastructure/di/ChatTokens";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";

@injectable()
export default class GetFilePreviewUseCase implements IUseCase<GetFilePreviewInputDTO, GetFilePreviewOutputDTO, ApplicationError>{
    constructor(
        @inject(CHAT_TOKENS.ChatMessageRepository)
        private messageRepo: IChatMessageRepository,
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService
    ){}

    async execute(input: GetFilePreviewInputDTO): Promise<Result<GetFilePreviewOutputDTO, ApplicationError>>{
        const { messageId } = input;
        const message = await this.messageRepo.findById(messageId);
        if(!message){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.MESSAGE_NOT_FOUND,
                'Chat message not found'
            ));
        }

        if(!message.isFile()){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                'File not found'
            ));
        }

        const { fileName, filePath, fileType, fileSize } = message.props.metadata;
        const fileBuffer = await this.storageService.getBuffer(SYS_BUCKETS.CHAT, filePath);
        const base64 = fileBuffer.toString('base64');
        const mimeType = message.props.metadata.fileType || 'application/octet-stream';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        return Result.ok({
            fileName,
            fileType,
            fileSize,
            dataUrl
        });
    }
};