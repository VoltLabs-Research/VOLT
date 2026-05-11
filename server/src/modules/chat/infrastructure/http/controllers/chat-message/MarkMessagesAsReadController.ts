import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MarkMessageAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { requiredTextSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { z } from 'zod/v4';

const markMessagesAsReadValidationSchema = {
    params: z.object({
        chatId: requiredTextSchema
    }).strict(),
    body: z.object({}).passthrough().optional().default({})
};

const MarkMessagesAsReadController = createController(MarkMessageAsReadUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: markMessagesAsReadValidationSchema,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default MarkMessagesAsReadController;
