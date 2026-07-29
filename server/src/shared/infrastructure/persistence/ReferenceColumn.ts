import { Column } from 'typeorm';
import { ENTITY_ID_LENGTH } from '@shared/infrastructure/persistence/entity-id';

interface ReferenceColumnOptions{
    nullable?: boolean;
}

export const ReferenceColumn = ({ nullable = false }: ReferenceColumnOptions = {}): PropertyDecorator => Column({
    type: 'varchar',
    length: ENTITY_ID_LENGTH,
    nullable
});
