import BaseController from '@/controllers/base-controller';
import { Action, getPermission } from '@/constants/permissions';
import { IAccessControlSubject } from '@/services/access-control/interfaces';
import { Request, Response, Router, NextFunction } from 'express';
import { Document } from 'mongoose';
import { catchAsync } from '@/utilities/runtime/runtime';
import accessControlService from '@/services/access-control/access-control-service';

// RBAC: Role-Based Access Control Middleware
export default class RBACMiddleware<T extends Document> {
    protected readonly controller: BaseController<T>;
    protected readonly router: Router;

    constructor(controller: BaseController<T>, router: Router) {
        this.controller = controller;
        this.router = router;
    }

    public authorize(action: Action) {
        return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
            const user = (req as any).user;
            const subject: IAccessControlSubject = {
                id: user._id.toString(),
                type: 'user'
            };

            const targetResource = this.controller.resource;
            const permission = getPermission(targetResource, action);
            await accessControlService.enforce(subject, req.params.teamId, permission);
            return next();
        });
    }

    public getHttpMethodByAction(action: Action): 'get' | 'post' | 'patch' | 'delete' {
        switch (action) {
            case Action.READ:
                return 'get';
            case Action.CREATE:
                return 'post';
            case Action.UPDATE:
                return 'patch';
            case Action.DELETE:
            default:
                return 'delete';
        }
    }

    public groupBy(action: Action, ...middlewares: any[]) {
        const httpMethod = this.getHttpMethodByAction(action);
        const expressRouter = this.router;
        const can = this.authorize(action);

        return {
            route(route: string, ...handlers: any[]) {
                expressRouter[httpMethod]('/:teamId' + route, ...middlewares, can, ...handlers);
                return this;
            }
        };
    }
};