import { BaseEntity, BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Repository } from 'typeorm';
import { ENTITY_ID_LENGTH, generateEntityId } from '@shared/infrastructure/persistence/entity-id';
import { getHiddenFields } from '@shared/infrastructure/persistence/Hidden';

const WIRE_ID = '_id';

interface ReferenceBinding{
    relationProperty: string;
    wireProperty: string;
}

export default abstract class BaseModel extends BaseEntity{
    @PrimaryColumn({
        type: 'varchar',
        length: ENTITY_ID_LENGTH
    })
    id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @BeforeInsert()
    protected assignIdentity(){
        if(!this.id) this.id = generateEntityId();
    }

    toJSON(): Record<string, unknown>{
        const hidden = getHiddenFields(this.constructor);
        const references = this.references();
        const relationProperties = new Set(references.map(({ relationProperty }) => relationProperty));
        const output: Record<string, unknown> = { [WIRE_ID]: this.id };

        for(const [key, value] of Object.entries(this)){
            if(key === 'id' || hidden.has(key) || relationProperties.has(key)) continue;
            output[key] = value;
        }

        for(const { relationProperty, wireProperty } of references){
            const loaded = this[relationProperty as keyof this];
            if(loaded !== undefined && !hidden.has(wireProperty)) output[wireProperty] = loaded;
        }

        return output;
    }

    private references(): ReferenceBinding[]{
        const model = this.constructor as unknown as { getRepository(): Repository<BaseModel> };
        const bindings: ReferenceBinding[] = [];

        for(const relation of model.getRepository().metadata.relations){
            const [column] = relation.joinColumns;
            if(!column) continue;

            bindings.push({
                relationProperty: relation.propertyName,
                wireProperty: column.propertyName
            });
        }

        return bindings;
    }
}
