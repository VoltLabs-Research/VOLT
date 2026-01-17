import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import MarkAllUserNotificationsAsReadUseCase from '../../../application/use-cases/MarkAllUserNotificationsAsReadUseCase';

@injectable()
export default class MarkAllUserNotificationsAsReadController extends BaseController<MarkAllUserNotificationsAsReadUseCase> {
    constructor(
        @inject(MarkAllUserNotificationsAsReadUseCase) useCase: MarkAllUserNotificationsAsReadUseCase
    ) {
        super(useCase);
    }
};