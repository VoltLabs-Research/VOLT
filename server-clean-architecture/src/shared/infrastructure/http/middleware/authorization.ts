import { Request, Response, NextFunction } from 'express';
import { Resource } from '@/src/core/constants/resources';
import { Action, getPermission } from '@/src/core/constants/permissions';
import { accessControlService } from '@/src/shared/infrastructure/services/AccessControlService';
import { IAccessControlSubject } from '@/src/shared/domain/ports/IAccessControlService';

/**
 * Authorization middleware factory.
 * Creates a middleware that enforces permission for a specific resource and action.
 * 
 * @param resource - The resource being accessed (e.g., Resource.CONTAINER)
 * @param action - The action being performed (e.g., Action.READ)
 * @returns Express middleware function
 */
export const authorize = (resource: Resource, action: Action) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as any).user;

            if (!user) {
                res.status(401).json({
                    status: 'error',
                    message: 'Unauthorized: No user found'
                });
                return;
            }

            // Get teamId from route params, query, or body
            const teamId = req.params.teamId || req.query.teamId || req.body?.teamId;

            if (!teamId) {
                res.status(400).json({
                    status: 'error',
                    message: 'Team ID is required for authorization'
                });
                return;
            }

            const subject: IAccessControlSubject = {
                id: user.id || user._id.toString(),
                type: 'user'
            };

            const permission = getPermission(resource, action);
            await accessControlService.enforce(subject, teamId as string, permission);

            next();
        } catch (error: any) {
            if (error.statusCode === 403) {
                res.status(403).json({
                    status: 'error',
                    code: error.code,
                    message: error.message
                });
                return;
            }
            next(error);
        }
    };
};

/**
 * Shorthand authorization helpers for common actions.
 */
export const canRead = (resource: Resource) => authorize(resource, Action.READ);
export const canCreate = (resource: Resource) => authorize(resource, Action.CREATE);
export const canUpdate = (resource: Resource) => authorize(resource, Action.UPDATE);
export const canDelete = (resource: Resource) => authorize(resource, Action.DELETE);
