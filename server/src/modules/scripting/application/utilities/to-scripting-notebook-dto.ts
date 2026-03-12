import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type {
    PopulatedScriptingNotebookTrajectory,
    ScriptingNotebookProps
} from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { ScriptingNotebookDTO } from '@modules/scripting/application/dtos/ScriptingNotebookDTO';

const toTrajectoryList = (
    trajectory: ScriptingNotebookProps['trajectory'],
    trajectories: ScriptingNotebookProps['trajectories']
): ScriptingNotebookDTO['trajectories'] => {
    if (Array.isArray(trajectories) && trajectories.length > 0) {
        return trajectories.map((entry) => {
            if (typeof entry === 'string') {
                return entry;
            }

            return {
                _id: entry._id,
                name: entry.name
            } satisfies PopulatedScriptingNotebookTrajectory;
        });
    }

    if (!trajectory) {
        return [];
    }

    return [trajectory];
};

const toPrimaryTrajectory = (
    trajectory: ScriptingNotebookProps['trajectory'],
    trajectories: ScriptingNotebookProps['trajectories']
): ScriptingNotebookDTO['trajectory'] => {
    if (trajectory) {
        return trajectory;
    }

    if (!Array.isArray(trajectories) || trajectories.length === 0) {
        return null;
    }

    return trajectories[0];
};

export const toScriptingNotebookDTO = (notebook: ScriptingNotebook): ScriptingNotebookDTO => {
    const primaryTrajectory = toPrimaryTrajectory(notebook.props.trajectory, notebook.props.trajectories);
    const trajectoryList = toTrajectoryList(notebook.props.trajectory, notebook.props.trajectories);

    return {
        _id: notebook._id,
        teamCluster: notebook.props.teamCluster,
        title: notebook.props.title,
        notebookPath: notebook.props.notebookPath,
        trajectory: primaryTrajectory,
        trajectories: trajectoryList,
        createdBy: notebook.props.createdBy,
        lastOpenedAt: notebook.props.lastOpenedAt,
        createdAt: notebook.props.createdAt,
        updatedAt: notebook.props.updatedAt
    };
};
