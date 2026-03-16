import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { createObjectIdParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';

const publicCanvasParamsSchema = createObjectIdParamsSchema(['trajectoryId']);

export const canvasValidation = createResourceValidation({
    getBootstrap: {
        params: publicCanvasParamsSchema
    }
});
