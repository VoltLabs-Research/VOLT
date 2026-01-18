import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import TrajectoryModel from '@modules/trajectory/infrastructure/persistence/mongo/models/TrajectoryModel';
import PluginModel from '@modules/plugin/infrastructure/persistence/mongo/models/PluginModel';
import AnalysisModel from '@modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';

@injectable()
export default class GetTeamMetricsController {
    handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { teamId } = req.params;

            // Get trajectory count
            const trajectoryCount = await TrajectoryModel.countDocuments({ team: teamId });

            // Get analysis count for team's trajectories
            const trajectories = await TrajectoryModel.find({ team: teamId }).select('_id').lean();
            const trajectoryIds = trajectories.map(t => t._id);
            const analysisCount = await AnalysisModel.countDocuments({ trajectory: { $in: trajectoryIds } });

            // Get plugin count
            const pluginCount = await PluginModel.countDocuments({ team: teamId });

            const metrics = {
                totals: {
                    trajectories: trajectoryCount,
                    analysis: analysisCount,
                    plugins: pluginCount
                },
                lastMonth: {
                    trajectories: 0,
                    analysis: 0
                },
                weekly: {
                    labels: []
                }
            };

            res.status(200).json({ status: 'success', data: metrics });
        } catch (error) {
            next(error);
        }
    };
}
