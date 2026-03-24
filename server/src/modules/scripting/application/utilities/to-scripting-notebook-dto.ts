import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type {
    ScriptingNotebookDTO,
    ScriptingNotebookPopulatedTeamCluster,
    ScriptingNotebookPopulatedTrajectory,
    ScriptingNotebookPopulatedUser
} from '@modules/scripting/application/dtos/ScriptingNotebookDTO';

// TODO: DELETE THIS FILE 

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const toRecordId = (value: unknown): string | null => {
    if (!isRecord(value) || value._id === undefined || value._id === null) {
        return null;
    }

    if (typeof value._id === 'string') {
        return value._id;
    }

    if (typeof value._id === 'object' && typeof value._id.toString === 'function') {
        return value._id.toString();
    }

    return null;
};

const toTrajectoryOutput = (value: unknown): string | ScriptingNotebookPopulatedTrajectory | null => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    const recordId = toRecordId(value);
    if (recordId && isRecord(value)) {
        return {
            _id: recordId,
            name: typeof value.name === 'string' ? value.name : undefined
        };
    }

    return null;
};

const toTeamClusterOutput = (value: unknown): string | ScriptingNotebookPopulatedTeamCluster | null => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    const recordId = toRecordId(value);
    if (recordId && isRecord(value)) {
        return {
            _id: recordId,
            name: typeof value.name === 'string' ? value.name : undefined
        };
    }

    return null;
};

const toUserOutput = (value: unknown): string | ScriptingNotebookPopulatedUser | undefined => {
    if (!value) {
        return undefined;
    }

    if (typeof value === 'string') {
        return value;
    }

    const recordId = toRecordId(value);
    if (recordId && isRecord(value)) {
        return {
            _id: recordId,
            firstName: typeof value.firstName === 'string' ? value.firstName : undefined,
            lastName: typeof value.lastName === 'string' ? value.lastName : undefined,
            email: typeof value.email === 'string' ? value.email : undefined,
            avatar: typeof value.avatar === 'string' ? value.avatar : undefined
        };
    }

    return undefined;
};

export const toScriptingNotebookDTO = (notebook: ScriptingNotebook): ScriptingNotebookDTO => {
    const notebookProps = notebook.props as unknown as Record<string, unknown>;

    return {
        _id: notebook._id,
        teamCluster: toTeamClusterOutput(notebookProps.teamCluster),
        title: notebook.props.title,
        notebookPath: notebook.props.notebookPath,
        trajectory: toTrajectoryOutput(notebookProps.trajectory),
        createdBy: toUserOutput(notebookProps.createdBy),
        lastOpenedAt: notebook.props.lastOpenedAt,
        createdAt: notebook.props.createdAt,
        updatedAt: notebook.props.updatedAt
    };
};
