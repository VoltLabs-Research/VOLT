import type { IChatRepository } from '../../domain/repositories/IChatRepository';

export class GetChatFilePreviewUseCase {
    constructor(private readonly chatRepository: IChatRepository) {}

    async execute(chatId: string, messageId: string): Promise<{ dataUrl: string; fileName: string; fileType: string; fileSize: number }> {
        return this.chatRepository.getFilePreview(chatId, messageId);
    }
}
