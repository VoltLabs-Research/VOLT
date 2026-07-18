export * from './shared/routing';
export * from './shared/errors';
export * from './shared/base';

export * as authHttp from './modules/auth/http';
export * as authDomain from './modules/auth/domain';
export { authRoutes } from './modules/auth/routes';

export * as containerHttp from './modules/container/http';
export * as containerDomain from './modules/container/domain';
export { containerRoutes } from './modules/container/routes';
