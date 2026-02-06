import FindActivityByTeamIdController from './FindActivityByTeamIdController';
import { container } from 'tsyringe';

export default {
    getByTeamId: container.resolve(FindActivityByTeamIdController)
};