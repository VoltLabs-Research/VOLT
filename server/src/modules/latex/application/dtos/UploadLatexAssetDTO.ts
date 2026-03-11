import type { LatexAssetDTO } from './LatexAssetDTO';

export interface UploadLatexAssetInputDTO {
    teamId: string;
    documentId: string;
    userId: string;
    file: Express.Multer.File;
};

export type UploadLatexAssetOutputDTO = LatexAssetDTO;
