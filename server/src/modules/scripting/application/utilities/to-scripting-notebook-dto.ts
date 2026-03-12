import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type {
    ScriptingNotebookDTO,
    ScriptingNotebookPopulatedTeamCluster,
    ScriptingNotebookPopulatedTrajectory,
    ScriptingNotebookPopulatedUser
} from '@modules/scripting/application/dtos/ScriptingNotebookDTO';

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const toTrajectoryOutput = (value: unknown): string | ScriptingNotebookPopulatedTrajectory | null => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (isRecord(value) && typeof value._id === 'string') {
        return {
            _id: value._id,
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

    if (isRecord(value) && typeof value._id === 'string') {
        return {
            _id: value._id,
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

    if (isRecord(value) && typeof value._id === 'string') {
        return {
            _id: value._id,
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
