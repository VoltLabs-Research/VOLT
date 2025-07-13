/* *****************************************************************************
 *
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
 *
***************************************************************************** */

#include <iostream>
#include <vector>
#include <zstd.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

// 128 KB
const size_t OUTPUT_BUFFER_SIZE = 131072;

class StreamingZstdDecompressor{
public:
    StreamingZstdDecompressor(){
        dstream = ZSTD_createDStream();
        if(dstream == NULL){
            throw std::runtime_error("ZSTD_createDStream() error");
        }

        ZSTD_initDStream(dstream);
        internalOutputBuffer.resize(OUTPUT_BUFFER_SIZE);
    }

    ~StreamingZstdDecompressor(){
        ZSTD_freeDStream(dstream);
    }

    emscripten::val decompress(const emscripten::val& compressedChunk){
        std::vector<uint8_t> compressedVector = emscripten::vecFromJSArray<uint8_t>(compressedChunk);
        ZSTD_inBuffer input = { compressedVector.data(), compressedVector.size(), 0 };
        decompressedDataForJS.clear();
        while(input.pos < input.size){
            ZSTD_outBuffer output = { internalOutputBuffer.data(), internalOutputBuffer.size(), 0 };
            size_t const ret = ZSTD_decompressStream(dstream, &output, &input);
            if(ZSTD_isError(ret)){
                throw std::runtime_error("ZSTD_decompressStream error");
            }
            decompressedDataForJS.insert(
                decompressedDataForJS.end(),
                internalOutputBuffer.begin(),
                internalOutputBuffer.begin() + output.pos
            );
        }
        return emscripten::val(emscripten::typed_memory_view(
            decompressedDataForJS.size(),
            decompressedDataForJS.data()
        ));
    }

private:
    ZSTD_DStream* dstream;
    std::vector<uint8_t> internalOutputBuffer; 
    std::vector<uint8_t> decompressedDataForJS;
};

EMSCRIPTEN_BINDINGS(zstd_module){
    emscripten::class_<StreamingZstdDecompressor>("StreamingZstdDecompressor")
        .constructor<>()
        .function("decompress", &StreamingZstdDecompressor::decompress);
}