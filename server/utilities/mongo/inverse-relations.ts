/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import mongoose, { Schema, Types } from 'mongoose';

type InverseBehavior = 'addToSet' | 'push' | 'set' | 'pull';
type OutMeta = {
    refModel: string;
    path: string;
    isArray: boolean;
    inversePath?: string;
    behavior: InverseBehavior;
};

const OUT_INDEX = new WeakMap<any, Map<string, OutMeta[]>>();

function getIndex(base: any) {
    let idx = OUT_INDEX.get(base);
    if (!idx) {
        idx = new Map<string, OutMeta[]>();
        OUT_INDEX.set(base, idx);
    }
    return idx;
}

function buildOutIndex(base: any) {
    const idx = getIndex(base);
    idx.clear();

    for (const modelName of base.modelNames()) {
        const M = base.model(modelName);
        const metas: OutMeta[] = [];

        M.schema.eachPath((path: string, schemaType: any) => {
            const opts = schemaType?.options ?? {};
            const pushMeta = (refModel: string, isArray: boolean, inverse?: any) => {
                metas.push({
                    refModel,
                    path,
                    isArray,
                    inversePath: inverse?.path,
                    behavior: (inverse?.behavior ?? 'addToSet') as InverseBehavior
                });
            };
            if (opts.ref) {
                const isArray = schemaType.instance === 'Array';
                pushMeta(opts.ref as string, isArray, opts.inverse);
            }
            if (Array.isArray(opts.type) && opts.type[0]?.ref) {
                pushMeta(opts.type[0].ref as string, true, opts.type[0].inverse);
            }
        });

        OUT_INDEX.get(base)!.set(modelName, metas);
    }
}

function getOutMeta(base: any, localModelName: string): OutMeta[] {
    const idx = getIndex(base);
    if (idx.size === 0) buildOutIndex(base);
    return idx.get(localModelName) ?? [];
}

const asIdArray = (val: any, isArray: boolean): Types.ObjectId[] => {
    if (isArray) return (val ?? []).filter(Boolean);
    return val ? [val] : [];
}


const useInverseRelations = (schema: Schema) => {
    schema.pre('save', async function (next) {
        const doc: any = this;
        if (doc.isNew) return next();

        const base = doc.constructor.base; 
        const metas = getOutMeta(base, doc.constructor.modelName).filter(m => m.inversePath);
        if (metas.length === 0) return next();

        const select: any = {};
        metas.forEach(m => (select[m.path] = 1));
        const prev = await doc.constructor.findById(doc._id).select(select).lean();
        doc.$locals.__prevRefs = prev ?? {};
        next();
    });
// Dentro de useInverseRelations (reemplaza el bloque de diffs por esto)
schema.post('save', async function (doc: any, next) {
  try {
    const base = doc.constructor.base;
    const metas = getOutMeta(base, doc.constructor.modelName).filter(m => m.inversePath);
    if (metas.length === 0) return next();

    const session = doc.$session?.();
    const prevRefs = doc.$locals?.__prevRefs ?? {};
    const ops: Promise<any>[] = [];

    for (const m of metas) {
const RefModel = doc.model(m.refModel);
if (!RefModel) {
  console.warn(`[useInverseRelations] Modelo ${m.refModel} no encontrado`);
  continue;
}
      const nowIds = asIdArray(doc[m.path], m.isArray).map((x: any) => x.toString());
      const prevIds = asIdArray(prevRefs[m.path], m.isArray).map((x: any) => x.toString());

      // 1) Siempre garantizar presencia (idempotente)
      if (m.behavior === 'addToSet' && nowIds.length) {
        ops.push(
          RefModel.updateMany(
            { _id: { $in: nowIds }, [m.inversePath!]: { $ne: doc._id } },
            { $addToSet: { [m.inversePath!]: doc._id } },
            { session }
          )
        );
      } else if (m.behavior === 'set' && nowIds.length) {
        // Para relaciones 1:1
        ops.push(
          RefModel.updateMany(
            { _id: { $in: nowIds } },
            { $set: { [m.inversePath!]: doc._id } },
            { session }
          )
        );
      }

      // 2) Limpiar los que ya no están (solo si tenemos prev)
      const toRemove = prevIds.filter(id => !nowIds.includes(id));
      if (toRemove.length) {
        ops.push(
          RefModel.updateMany(
            { _id: { $in: toRemove } },
            { $pull: { [m.inversePath!]: doc._id } },
            { session }
          )
        );
      }
    }

    await Promise.all(ops);
    next();
  } catch (e) {
    next(e as any);
  }
});

}

export default useInverseRelations;