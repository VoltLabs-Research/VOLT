import { ErrorCodes } from '@core/constants/error-codes';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import unzipper from 'unzipper';

interface PluginArchiveContents {
    workflowProps: WorkflowProps;
    binaryFile?: unzipper.File;
}

const invalidArchive = (message: string): ApplicationError => {
    return ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, message);
};

/**
 * A zip may or may not wrap its contents in a single top-level directory; when it
 * does, that directory is transparent and every lookup happens beneath it.
 */
const detectArchiveRootPrefix = (paths: string[]): string => {
    const topLevelSegments = new Set(
        paths.map((entryPath) => entryPath.split('/')[0]).filter((segment) => segment.length > 0)
    );

    if (topLevelSegments.size !== 1) {
        return '';
    }

    const [onlySegment] = [...topLevelSegments];
    const isWrapperDir = paths.some((entryPath) => entryPath.startsWith(`${onlySegment}/`));
    return isWrapperDir ? `${onlySegment}/` : '';
};

/**
 * A plugin.json can come from a hand-edited zip, so its workflow really is
 * untrusted input and gets shape-checked before it is treated as a graph.
 */
export const isWorkflowProps = (value: unknown): value is WorkflowProps => {
    return isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges);
};

/**
 * Decodes a user-uploaded plugin `.zip` into its manifest workflow and, when the
 * archive carries one, the entrypoint binary entry. Every failure mode here is a
 * malformed upload, so all of them surface as a bad request.
 */
export const readPluginArchive = async (fileBuffer: Buffer): Promise<PluginArchiveContents> => {
    let directory: unzipper.CentralDirectory;

    try {
        directory = await unzipper.Open.buffer(fileBuffer);
    } catch {
        throw invalidArchive('Invalid plugin ZIP archive');
    }

    const archivePrefix = detectArchiveRootPrefix(directory.files.map((file) => file.path));
    const pluginJsonFile = directory.files.find((file) => file.path === `${archivePrefix}plugin.json`);
    if (!pluginJsonFile) {
        throw invalidArchive('Invalid plugin ZIP archive: plugin.json is required');
    }

    let importData: unknown;

    try {
        importData = JSON.parse((await pluginJsonFile.buffer()).toString('utf-8'));
    } catch {
        throw invalidArchive('Invalid plugin manifest JSON');
    }

    if (!isRecord(importData) || !isWorkflowProps(importData.workflow)) {
        throw invalidArchive('Invalid plugin import format: workflow is required');
    }

    return {
        workflowProps: importData.workflow,
        binaryFile: directory.files.find((file) => {
            return file.path.startsWith(`${archivePrefix}binary/`)
                && file.path !== `${archivePrefix}binary/`
                && file.type !== 'Directory';
        })
    };
};
