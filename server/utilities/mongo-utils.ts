import type { Model, SaveOptions } from 'mongoose';

export const upsert = async <T>(
    Model: Model<T>,
    filter: Record<string, any>,
    update: Record<string, any>,
    opts?: {
        session?: any;
        saveOptions?: SaveOptions;
        includeFilterOnInsert?: boolean;
        retryOnDuplicateKey?: boolean;
    }
): Promise<T> => {
    const {
        session,
        saveOptions,
        includeFilterOnInsert = true,
        retryOnDuplicateKey = true
    } = opts || {};

    const hasOps = update && Object.keys(update).some((key) => key.startsWith('$'));
    const $set = hasOps ? (update.$set ?? {}) : update ?? {};
    const $setOnInsert = hasOps ? (update.$setOnInsert ?? {}) : {};

    let existingDocument = await Model.findOne(filter, null, { session });
    if(existingDocument){
        existingDocument.set($set);
        await existingDocument.save({
            session,
            ...saveOptions,
            // for 'save' mongoose hook
            validateModifiedOnly: true
        });
        return existingDocument as any;
    }

    const toInsert = {
        ...(includeFilterOnInsert ? filter : {}),
        ...$setOnInsert,
        ...$set
    };

    try{
        const created = new Model(toInsert);
        await created.save({ session, ...saveOptions });
        return created as any;
    }catch(err: any){
        if(retryOnDuplicateKey && err?.code === 11000){
            const again = await Model.findOne(filter, null, { session });
            if(!again){
                throw err;
            }

            again.set($set);
            await again.save({ session, ...saveOptions });

            return again as any;
        }

        throw err;
    }
};