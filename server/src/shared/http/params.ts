import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

export type ParamResolver = (req: AuthenticatedRequest, res: Response) => unknown | Promise<unknown>;

const paramsByHandler = new WeakMap<object, Map<string | symbol, ParamResolver[]>>();

export const createParamDecorator = (resolve: ParamResolver): ParameterDecorator =>
    (target, handlerName, index) => {
        if (handlerName === undefined) return;
        const perCtor = paramsByHandler.get(target.constructor) ?? new Map<string | symbol, ParamResolver[]>();
        const list = perCtor.get(handlerName) ?? [];
        list[index] = resolve;
        perCtor.set(handlerName, list);
        paramsByHandler.set(target.constructor, perCtor);
    };

export const getParamResolvers = (ctor: object, handlerName: string | symbol): ParamResolver[] =>
    paramsByHandler.get(ctor)?.get(handlerName) ?? [];

export const Body = <T>(validate?: (raw: unknown) => T): ParameterDecorator =>
    createParamDecorator((req) => (validate ? validate(req.body) : req.body));

export const Param = (name: string): ParameterDecorator =>
    createParamDecorator((req) => (req.params as Record<string, string>)[name]);

export const Query = (name?: string): ParameterDecorator =>
    createParamDecorator((req) => (name === undefined ? req.query : (req.query as Record<string, string>)[name]));

export const CurrentUser = (): ParameterDecorator =>
    createParamDecorator((req) => req.userId);

export const Ip = (): ParameterDecorator =>
    createParamDecorator((req) => req.ip ?? '');

export const UserAgent = (): ParameterDecorator =>
    createParamDecorator((req) => (req.headers['user-agent'] as string | undefined) ?? '');

export const Req = (): ParameterDecorator => createParamDecorator((req) => req);
export const Res = (): ParameterDecorator => createParamDecorator((_req, res) => res);
