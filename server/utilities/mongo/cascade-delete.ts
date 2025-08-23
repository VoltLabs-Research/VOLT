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

import mongoose, { Schema, Model, Types } from 'mongoose';

type Behavior = 'delete' | 'pull' | 'unset' | 'setNull';
type RefMeta = { model: string; path: string; isArray: boolean; behavior: Behavior };

// key: targetModelName
const REF_INDEX = new Map<string, RefMeta[]>();

const buildRefIndex = () => {
    REF_INDEX.clear();

    for(const name of mongoose.modelNames()){
        const model = mongoose.model(name);
        
        model.schema.eachPath((path, schemaType: any) => {
            const opts = schemaType?.options ?? {};

            // single ref
            if(opts.ref){
                const isArray = schemaType.instance === 'Array';
                const behavior: Behavior = opts.cascade ?? 'unset';
                const target = opts.ref as string;

                (REF_INDEX.get(target) ?? REF_INDEX.set(target, []).get(target)!).push({ model: name, path, isArray, behavior });
            }

            // array of refs [{ type: ObjectId, ref: 'X , cascade: ...}]
            if(Array.isArray(opts.type) && opts.type[0]?.ref){
                const behavior: Behavior = opts.type[0].cascade ?? 'unset';
                const target = opts.type[0].ref as string;
                (REF_INDEX.get(target) ?? REF_INDEX.set(target, []).get(target)!).push({ model: name, path, isArray: true, behavior });
            }
        });
    }
};

const getIncomingRefs = (targetModelName: string): RefMeta[] => {
    if(REF_INDEX.size === 0) buildRefIndex();

    return REF_INDEX.get(targetModelName) ?? [];
};

const useCascadeDelete = (schema: Schema, { recursive = true, maxDepth = 5 }: { recursive?: boolean; maxDepth?: number } = {}) => {

    const runCascade = async (modelName: string, id: Types.ObjectId, session?: mongoose.ClientSession, depth = 0, visited = new Set<string>()) => {
        if(depth > maxDepth) return;
        const key = `${modelName}:${id.toString()}`;

        if(visited.has(key)) return;
        visited.add(key);

        const refs = getIncomingRefs(modelName);
        const ops: Promise<any>[] = [];

        for(const ref of refs){
            const model = mongoose.model(ref.model);

            if(ref.isArray){
                if(ref.behavior === 'pull'){
                    ops.push(model.updateMany({ [ref.path]: id }, { $pull: { [ref.path]: id } }, { session }));
                }else if(ref.behavior === 'delete'){
                    const toDelete = await model.find({ [ref.path]: id }).session(session!);
                    if(toDelete.length){
                        if(recursive){
                            for(const document of toDelete){
                                await runCascade(model.modelName, document._id, session, depth + 1,visited);
                            }
                        }

                        ops.push(model.deleteMany({ _id: { $in: toDelete.map((document) => document._id) } }).session(session!));
                    }
                }else if(ref.behavior === 'unset' || ref.behavior === 'setNull'){
                    ops.push(model.updateMany({ [ref.path]: id }, { $pull: { [ref.path]: id } }, { session }));
                }
            }else{
                if(ref.behavior === 'delete'){
                    const toDelete = await model.find({ [ref.path]: id }).session(session!);
                    if(toDelete.length){
                        if(recursive){
                            for(const document of toDelete){
                                await runCascade(model.modelName, document._id, session, depth + 1, visited);
                            }
                        }

                        ops.push(model.deleteMany({ _id: { $in: toDelete.map((document) => document._id) } }).session(session!));
                    }
                }else if(ref.behavior === 'unset'){
                    ops.push(model.updateMany({ [ref.path]: id }, { $unset: { [ref.path]: '' } }, { session }));
                }else if(ref.behavior === 'setNull'){
                    ops.push(model.updateMany({ [ref.path]: id }, { $set: { [ref.path]: null } }, { session }));
                }
            }
        }

        await Promise.all(ops);
    };

    schema.pre('deleteOne', { document: true, query: false }, async function(next){
        const doc: any = this;
        const session = doc.$session?.();
        await runCascade(doc.constructor.modelName, doc._id, session);
        next();
    });

    schema.pre('findOneAndDelete', { document: false, query: true }, async function(next){
        const q: any = this;
        const session = q?.options?.session;
        const doc = await q.model.findOne(q.getFilter()).session(session);
        if(doc){
            await runCascade(q.model.modelName, doc._id, session);
        }
        next();
    });
};

export default useCascadeDelete;
