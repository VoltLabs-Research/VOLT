/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
