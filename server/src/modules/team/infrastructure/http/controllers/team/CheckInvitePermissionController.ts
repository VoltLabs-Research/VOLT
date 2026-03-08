import { createController } from '@shared/infrastructure/http/controllers/createController';
import CheckInvitePermissionUseCase from '@modules/team/application/use-cases/team/CheckInvitePermissionUseCase';

const CheckInvitePermissionController = createController(CheckInvitePermissionUseCase);
export default CheckInvitePermissionController;
