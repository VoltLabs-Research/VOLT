import { container } from 'tsyringe';

type ControllerClass<TInstance = unknown> = new (...args: any[]) => TInstance;

export const createControllerRegistry = <TControllers extends Record<string, ControllerClass>>(
    controllers: TControllers
): { [K in keyof TControllers]: InstanceType<TControllers[K]> } => {
    return Object.fromEntries(
        Object.entries(controllers).map(([key, controller]) => [key, container.resolve(controller)])
    ) as { [K in keyof TControllers]: InstanceType<TControllers[K]> };
};
