import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { presentCatalogFolder } from '@shared/application/catalog/catalog-folder-presenter';
import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { Response } from 'express';

interface FolderRouteParams {
    teamId: string;
    folderId?: string;
}

interface FolderListQuery {
    page?: number;
    limit?: number;
    parentId?: string;
}

interface FolderBody {
    title: string;
    parentId?: string | null;
}

type UseCaseResult<TValue> = {
    success: true;
    value: TValue;
} | {
    success: false;
    error: unknown;
};

interface CreateCatalogFolderRouteHandlersOptions<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TDeleteInput
> {
    repository: ICatalogFolderRepository<TFolder, TFolderProps>;
    folderLabel: string;
    deleteFolder: (input: TDeleteInput) => Promise<UseCaseResult<null>>;
    deleteStatusCode?: HttpStatus;
    buildDeleteInput?: (req: AuthenticatedRequest) => TDeleteInput;
}

export const createCatalogFolderRouteHandlers = <
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TDeleteInput = { teamId: string; folderId: string }
>({
    repository,
    folderLabel,
    deleteFolder,
    deleteStatusCode = HttpStatus.OK,
    buildDeleteInput = (req) => {
        const { teamId, folderId } = req.params as unknown as FolderRouteParams;
        return { teamId, folderId: folderId as string } as TDeleteInput;
    }
}: CreateCatalogFolderRouteHandlersOptions<TFolder, TFolderProps, TDeleteInput>) => ({
    list: async (req: AuthenticatedRequest, res: Response) => {
        const { teamId } = req.params as unknown as FolderRouteParams;
        const { page = 1, limit = 500, parentId } = req.query as FolderListQuery;
        const result = await repository.findAllByTeamAndParent(teamId, parentId ?? null, { page, limit });

        BaseResponse.paginated(res, {
            ...result,
            data: result.data.map((folder) => presentCatalogFolder(folder))
        });
    },
    get: async (req: AuthenticatedRequest, res: Response) => {
        const { teamId, folderId } = req.params as unknown as FolderRouteParams;
        const folder = await repository.findByTeamAndFolderId(teamId, folderId as string);

        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, `${folderLabel} not found`);
        }

        BaseResponse.success(res, presentCatalogFolder(folder));
    },
    create: async (req: AuthenticatedRequest, res: Response) => {
        const { teamId } = req.params as unknown as FolderRouteParams;
        const { title, parentId } = req.body as FolderBody;
        const folder = await repository.create({
            team: teamId,
            createdBy: req.userId as string,
            title,
            parent: parentId ?? null,
            createdAt: new Date(),
            updatedAt: new Date()
        } as TFolderProps);

        BaseResponse.success(res, presentCatalogFolder(folder), HttpStatus.Created);
    },
    update: async (req: AuthenticatedRequest, res: Response) => {
        const { teamId, folderId } = req.params as unknown as FolderRouteParams;
        const { title } = req.body as FolderBody;
        const folder = await repository.findByTeamAndFolderId(teamId, folderId as string);

        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, `${folderLabel} not found`);
        }

        const updated = await repository.updateById(folderId as string, {
            title,
            updatedAt: new Date()
        } as Partial<TFolderProps>);

        BaseResponse.success(res, presentCatalogFolder(updated ?? folder));
    },
    delete: async (req: AuthenticatedRequest, res: Response) => {
        const result = await deleteFolder(buildDeleteInput(req));

        if (!result.success) {
            BaseResponse.fromError(res, result.error);
            return;
        }

        if (deleteStatusCode === HttpStatus.NoContent) {
            res.status(deleteStatusCode).send();
            return;
        }

        BaseResponse.success(res, result.value, deleteStatusCode);
    }
});
