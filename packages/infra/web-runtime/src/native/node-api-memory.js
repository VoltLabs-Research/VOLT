// Node-API hands native code the bytes of an ArrayBuffer itself; emnapi hands it a copy in wasm
// memory. This restores Node's behaviour for the addons, which write into those bytes: what native
// code writes is copied back to each buffer when the call returns. It runs before the library code,
// rebinding the hoisted functions the wasm imports are taken from.
var lentArrayBuffers = new Map();

// The pointer napi_create_buffer_copy returns in result_data must hold the copied bytes, as in Node
// (emnapi writes them only to the JS buffer, and the copy-back would undo that). Library functions
// the addon does not use are not linked.
if(typeof _napi_create_buffer_copy === 'function'){
    var emnapiCreateBufferCopy = _napi_create_buffer_copy;
    _napi_create_buffer_copy = function(env, length, data, result_data, result){
        var status = emnapiCreateBufferCopy(env, length, data, result_data, result);
        if(status === 0 && result_data && length){
            var address = new Uint32Array(wasmMemory.buffer)[result_data >>> 2];
            new Uint8Array(wasmMemory.buffer).copyWithin(address, data, data + length);
        }
        return status;
    };
}

var returnLentMemory = function(){
    lentArrayBuffers.forEach(function(address, arrayBuffer){
        if(!emnapiExternalMemory.isDetachedArrayBuffer(arrayBuffer)){
            new Uint8Array(arrayBuffer).set(new Uint8Array(wasmMemory.buffer, address, arrayBuffer.byteLength));
        }
    });
    lentArrayBuffers.clear();
};

var emnapiInitAddon = emnapiInit;
emnapiInit = function(options){
    // An addon that takes no buffers links no external memory, and has nothing to copy back.
    if(typeof emnapiExternalMemory === 'undefined'){
        return emnapiInitAddon(options);
    }
    var getArrayBufferPointer = emnapiExternalMemory.getArrayBufferPointer;
    emnapiExternalMemory.getArrayBufferPointer = function(arrayBuffer, shouldCopy){
        var info = getArrayBufferPointer(arrayBuffer, shouldCopy);
        if(info.address && info.runtimeAllocated){
            lentArrayBuffers.set(arrayBuffer, info.address);
        }
        return info;
    };
    var exports = emnapiInitAddon(options);
    Object.keys(exports).forEach(function(name){
        var method = exports[name];
        if(typeof method === 'function'){
            exports[name] = function(){
                try{
                    return method.apply(this, arguments);
                }finally{
                    returnLentMemory();
                }
            };
        }
    });
    return exports;
};
