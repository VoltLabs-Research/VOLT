import { ErrorCodes } from '@core/constants/error-codes';
import { Container } from '@modules/container/domain/entities/Container';
import containerMapper from '@modules/container/infrastructure/persistence/mongo/mappers/ContainerMapper';
import { ContainerModel } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Transient } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { IContainerProps } from '@modules/container/domain/entities/Container';
import type { IContainer as IContainerDoc } from '@modules/container/infrastructure/persistence/mongo/models/ContainerModel';
import type { FindOptions } from '@shared/domain/port/IBaseRepository';

const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';
const PLACEHOLDER_PUBLIC_PORT = 0;

@Transient()
export class ContainerRepository extends MongooseBaseRepository<Container, IContainerProps, IContainerDoc> {
    constructor() {
        super(ContainerModel, containerMapper);
    }

    private normalizePorts(ports: IContainerProps['ports'] | undefined): IContainerProps['ports'] | undefined {
        if (!ports) {
            return ports;
        }

        return ports.map((port) => {
            if (port.public === undefined || port.public === PLACEHOLDER_PUBLIC_PORT) {
                return {
                    private: port.private
                };
            }

            return port;
        });
    }

    private toCreatePersistenceData(data: Partial<IContainerProps>): Record<string, unknown> {
        const normalizedData: Partial<IContainerProps> = {
            ...data
        };

        if ('ports' in data) {
            normalizedData.ports = this.normalizePorts(data.ports);
        }

        const persistenceData = this.mapper.toPersistence(normalizedData);

        if (data.internalIp === undefined || data.internalIp === PLACEHOLDER_INTERNAL_IP) {
            Reflect.deleteProperty(persistenceData, 'internalIp');
        }

        return persistenceData;
    }

    private toUpdatePersistenceData(data: Partial<IContainerProps>): Record<string, unknown> {
        const normalizedData: Partial<IContainerProps> = {
            ...data
        };

        if ('ports' in data) {
            normalizedData.ports = this.normalizePorts(data.ports);
        }

        const persistenceData = this.mapper.toPersistence(normalizedData);
        const unset: Record<string, ''> = {};

        if ('internalIp' in data && (data.internalIp === undefined || data.internalIp === PLACEHOLDER_INTERNAL_IP)) {
            Reflect.deleteProperty(persistenceData, 'internalIp');
            unset.internalIp = '';
        }

        if (Object.keys(unset).length > 0) {
            return {
                ...persistenceData,
                $unset: unset
            };
        }

        return persistenceData;
    }

    async create(data: Partial<IContainerProps>): Promise<Container> {
        const persistenceData = this.toCreatePersistenceData(data);
        const doc = await this.model.create(persistenceData);

        return this.mapper.toDomain(doc);
    }

    async updateById(
        id: string,
        data: Partial<IContainerProps>,
        options?: Pick<FindOptions<IContainerProps>, 'populate' | 'select'>
    ): Promise<Container | null> {
        const persistenceData = this.toUpdatePersistenceData(data);
        const updatedContainer = await this.model.findByIdAndUpdate(id, persistenceData, { new: true }).exec();

        if (!updatedContainer) {
            return null;
        }

        return this.findById(id, options);
    }

    async findByIdOrFail(containerId: string): Promise<Container> {
        const container = await this.findById(containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }
        return container;
    }
}
