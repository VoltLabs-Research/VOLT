import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';

@injectable()
export default class UploadFileController extends BaseController<any> {
    constructor() {
        super({} as any, HttpStatus.OK);
    }

    public handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const fileData = req.body.fileData;

            if (!fileData) {
                BaseResponse.error(res, 'File upload failed', HttpStatus.BadRequest);
                return;
            }

            // Construct URL for the file
            // Assuming the server serves this at /api/chat-messages/files/:filename
            // Note: In production this should be a full CDN URL or similar.
            const url = `/api/chat-messages/files/${fileData.filename}`;

            BaseResponse.success(res, {
                ...fileData,
                url
            }, HttpStatus.OK);
        } catch (error) {
            BaseResponse.error(res, (error as Error).message, HttpStatus.InternalServerError);
        }
    }
}
