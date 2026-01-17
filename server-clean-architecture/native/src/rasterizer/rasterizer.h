/**
 * Copyright(c) 2025, Rodolfo Herrera Hernandez. All rights reserved.
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

#pragma once

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#include <cstdlib>
#include <cstdint>
#include <cstring>
#include <cmath>
#include <vector>
#include <thread>
#include <algorithm>
#include <string>

#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>

class Rasterizer{
public:
    /**
     * @brief Rendering options.
     */
    struct Options{
        // Vertical field-of-view in degress.
        float fovDeg = 60.f;
        // Multiplicative scale factor applied to camera distance.
        float distScale = 1.f;
        // If true: Z is up; otherwise Y is up.
        bool zUp = true;
    };

    /**
     * @brief Rasterize a GLB file to a PNG file
     */
    bool rasterize(
        const char* glbPath,
        const char* pngPath,
        int width,
        int height,
        float azDeg,
        float elDeg,
        const Options &opts
    ){
        // Map the GLB file and extract lightweight views into its buffers.
        MMapFile mm;
        GLBView glb{};
        if(!parseGLB_MMap(glbPath, glb, mm)){
            mm.close();
            return false;
        }

        if(glb.vertexCount == 0 || !glb.pos){
            mm.close();
            return false;
        }

        // Compute objects bounds to derive camera framing.
        Bounds b = computeBoundsParallel(glb.pos, glb.vertexCount);
        float cx = (b.minX + b.maxX) * 0.5f;
        float cy = (b.minY + b.maxY) * 0.5f;
        float cz = (b.minZ + b.maxZ) * 0.5f;

        float dx = b.maxX - b.minX, dy = b.maxY - b.minY, dz = b.maxZ - b.minZ;
        float radius = 0.5f * std::sqrt(dx * dx + dy * dy + dz * dz);

        // Build camera matrices (lookAt + perspective) 
        float fovRad = opts.fovDeg * 3.1415926535f / 180.f;
        float aspect = (float)width / height;

        float distance = 1.2f * radius / std::tan(fovRad * 0.5f) * opts.distScale;
        if(distance < 1e-3f) distance = 1e-3f;

        float znear = std::max(1e-3f, distance - radius * 2.f);
        float zfar  = distance + radius * 2.f;

        float az = azDeg * 3.1415926535f / 180.f;
        float el = elDeg * 3.1415926535f / 180.f;

        float dirX, dirY, dirZ;
        if(opts.zUp){
            dirX = std::cos(el) * std::cos(az);
            dirY = std::cos(el) * std::sin(az);
            dirZ = std::sin(el);
        }else{
            dirX = std::cos(el) * std::cos(az);
            dirY = std::sin(el);
            dirZ = std::cos(el) * std::sin(az);
        }

        float eyeX = cx + dirX * distance;
        float eyeY = cy + dirY * distance;
        float eyeZ = cz + dirZ * distance;

        float upX = 0.f;
        float upY = opts.zUp ? 0.f : 1.f;
        float upZ = opts.zUp ? 1.f : 0.f;

        Mat4 view = Mat4::lookAt(eyeX, eyeY, eyeZ, cx, cy, cz, upX, upY, upZ);
        Mat4 proj = Mat4::perspective(fovRad, aspect, znear, zfar);
        Mat4 mvp = proj * view;

        // Allocate and initialize z-buffer + RGBA color buffer
        size_t pixels = (size_t)width * (size_t)height;
        
        uint32_t* zBuffer = (uint32_t*) aligned_malloc(pixels * 4);
        uint8_t* colorBuffer = (uint8_t*) aligned_malloc(pixels * 4);
        if(!zBuffer || !colorBuffer){
            free(zBuffer);
            free(colorBuffer);
            mm.close();
            return false;
        }

        for(size_t i = 0; i < pixels; i++){
            zBuffer[i] = 0xFFFFFFFF;
        }

        std::memset(colorBuffer, 0, pixels * 4);

        // Rasterize
        if(glb.type == GLBType::TRIANGLES && glb.indexCount > 0){
            rasterizeTriangles(glb, mvp, width, height, zBuffer, colorBuffer);
        }else{
            rasterizePoints(glb.pos, glb.col, glb.vertexCount, mvp, width, height, zBuffer, colorBuffer);
        }

        // Write PNG output
        int ok = stbi_write_png(pngPath, width, height, 4, colorBuffer, width * 4);

        // Cleanup
        free(zBuffer);
        free(colorBuffer);
        mm.close();
        return ok != 0;
    }

private:
    static void* aligned_malloc(size_t size, size_t align = 32){
        void* p = nullptr;
        size = (size + (align - 1)) & ~(align - 1);
        if(posix_memalign(&p, align, size) != 0) return nullptr;
        return p;
    }

    static inline uint32_t read_u32(const void* p){
        uint32_t v;
        std::memcpy(&v, p, 4);
        return v;
    }

    struct MMapFile{
        int fd = -1;
        size_t size = 0;
        uint8_t* data = nullptr;

        bool openRead(const char* path){
            fd = ::open(path, O_RDONLY);
            if(fd < 0) return false;

            struct stat st;
            if(fstat(fd, &st) != 0) return false;

            size = (size_t) st.st_size;
            data = (uint8_t*) mmap(nullptr, size, PROT_READ, MAP_PRIVATE, fd, 0);

            if(!data || data == MAP_FAILED){
                data = nullptr;
                return false;
            }

            return true;
        }

        void close(){
            if(data) munmap(data, size);
            if(fd >= 0) ::close(fd);

            fd = -1;
            size = 0;
            data = nullptr;
        }
    };

    enum class GLBType{
        POINTS,
        TRIANGLES
    };

    struct GLBView{
        const float* pos = nullptr;
        const float* col = nullptr;
        const float* normals = nullptr;
        const uint16_t* idx16 = nullptr;
        const uint32_t* idx32 = nullptr;
        size_t vertexCount = 0;
        size_t indexCount = 0;
        size_t colorStride = 3; // 3 for VEC3 (RGB), 4 for VEC4 (RGBA)
        GLBType type = GLBType::POINTS;
    };

    static int findInt(const std::string& json, const char* key){
        std::string k = std::string("\"") + key + "\":";
        size_t p = json.find(k);
        if(p == std::string::npos) return -1;
        return std::atoi(json.c_str() + p + k.size());
    }

    // Find integer value for a key starting from a given position
    static int findIntFrom(const std::string& json, const char* key, size_t startPos){
        std::string k = std::string("\"") + key + "\":";
        size_t p = json.find(k, startPos);
        if(p == std::string::npos) return -1;
        return std::atoi(json.c_str() + p + k.size());
    }

    // Parse bufferView info: byteOffset and byteLength
    struct BufferViewInfo {
        size_t byteOffset = 0;
        size_t byteLength = 0;
    };

    static BufferViewInfo parseBufferView(const std::string& json, int index) {
        BufferViewInfo info;
        // Find "bufferViews" array
        size_t bvPos = json.find("\"bufferViews\"");
        if (bvPos == std::string::npos) return info;
        
        // Find the opening bracket
        size_t arrStart = json.find('[', bvPos);
        if (arrStart == std::string::npos) return info;
        
        // Navigate to the nth bufferView object
        size_t pos = arrStart + 1;
        int currentIndex = 0;
        int braceDepth = 0;
        size_t objStart = 0;
        
        while (pos < json.size() && currentIndex <= index) {
            char c = json[pos];
            if (c == '{') {
                if (braceDepth == 0) objStart = pos;
                braceDepth++;
            } else if (c == '}') {
                braceDepth--;
                if (braceDepth == 0) {
                    if (currentIndex == index) {
                        // Found our bufferView, parse it
                        std::string bvJson = json.substr(objStart, pos - objStart + 1);
                        info.byteOffset = findIntFrom(bvJson, "byteOffset", 0);
                        if (info.byteOffset == (size_t)-1) info.byteOffset = 0;
                        info.byteLength = findIntFrom(bvJson, "byteLength", 0);
                        if (info.byteLength == (size_t)-1) info.byteLength = 0;
                        return info;
                    }
                    currentIndex++;
                }
            }
            pos++;
        }
        return info;
    }

    static bool parseGLB_MMap(const char* path, GLBView& out, MMapFile& mm){
        if(!mm.openRead(path)) return false;
        if(mm.size < 12) return false;

        const uint8_t* p = mm.data;
        if(read_u32(p) != 0x46546C67u || read_u32(p + 4) != 2u) return false;

        size_t off = 12;
        const uint8_t* jsonData = nullptr;
        uint32_t jsonLen = 0;
        const uint8_t* bin = nullptr;
        uint32_t binLen = 0;

        while(off + 8 <= mm.size){
            uint32_t clen = read_u32(p + off);
            uint32_t ctyp = read_u32(p + off + 4);

            off += 8;
            if(off + clen > mm.size) break;
            
            if(ctyp == 0x4E4F534Au){
                jsonData = p + off;
                jsonLen = clen;
            }else if(ctyp == 0x004E4942u){
                bin = p + off;
                binLen = clen;
            }

            off += clen;
        }

        if(!bin || binLen == 0) return false;

        std::string json((char*) jsonData, jsonLen);
        
        int mode = findInt(json, "mode");
        bool isMesh = (mode == 4);
        out.type = isMesh ? GLBType::TRIANGLES : GLBType::POINTS;

        if(isMesh){
            // Check if COLOR_0 exists and determine if it's VEC3 or VEC4
            bool hasColors = (json.find("COLOR_0") != std::string::npos);
            bool colorIsVec4 = false;
            if(hasColors){
                size_t colorAccPos = json.find("\"COLOR_0\"");
                if(colorAccPos != std::string::npos){
                    size_t vec4Pos = json.find("\"VEC4\"", colorAccPos);
                    size_t vec3Pos = json.find("\"VEC3\"", colorAccPos);
                    if(vec4Pos != std::string::npos && (vec3Pos == std::string::npos || vec4Pos < vec3Pos)){
                        colorIsVec4 = true;
                    }
                }
            }
            out.colorStride = colorIsVec4 ? 4 : 3;

            // Determine index type (5123 = uint16, 5125 = uint32)
            size_t pos5123 = json.find("5123");
            size_t pos5125 = json.find("5125");
            bool useU16 = (pos5123 != std::string::npos && (pos5125 == std::string::npos || pos5123 < pos5125));

            // Parse bufferViews to get correct offsets
            // Layout for mesh with colors: BV0=positions, BV1=normals, BV2=colors, BV3=indices
            // Layout for mesh without colors: BV0=positions, BV1=normals, BV2=indices
            BufferViewInfo bvPos = parseBufferView(json, 0);
            BufferViewInfo bvNorm = parseBufferView(json, 1);
            BufferViewInfo bvCol, bvIdx;
            
            if(hasColors){
                bvCol = parseBufferView(json, 2);
                bvIdx = parseBufferView(json, 3);
            }else{
                bvIdx = parseBufferView(json, 2);
            }

            // Validate bufferView data - reject if no valid geometry
            if(bvPos.byteLength == 0 || bvIdx.byteLength == 0){
                return false;
            }

            // Validate offsets are within binary buffer bounds
            if(bvPos.byteOffset + bvPos.byteLength > binLen ||
               bvNorm.byteOffset + bvNorm.byteLength > binLen ||
               bvIdx.byteOffset + bvIdx.byteLength > binLen){
                return false;
            }
            if(hasColors && bvCol.byteOffset + bvCol.byteLength > binLen){
                return false;
            }

            // Calculate vertex count from position buffer (VEC3 floats)
            out.vertexCount = bvPos.byteLength / (3 * sizeof(float));
            
            // Calculate index count
            if(useU16){
                out.indexCount = bvIdx.byteLength / sizeof(uint16_t);
            }else{
                out.indexCount = bvIdx.byteLength / sizeof(uint32_t);
            }

            // Reject empty meshes
            if(out.vertexCount == 0 || out.indexCount == 0){
                return false;
            }

            // Set pointers using bufferView offsets
            out.pos = (const float*)(bin + bvPos.byteOffset);
            out.normals = (const float*)(bin + bvNorm.byteOffset);
            
            if(hasColors && bvCol.byteLength > 0){
                out.col = (const float*)(bin + bvCol.byteOffset);
            }

            if(out.indexCount > 0){
                if(useU16){
                    out.idx16 = (const uint16_t*)(bin + bvIdx.byteOffset);
                }else{
                    out.idx32 = (const uint32_t*)(bin + bvIdx.byteOffset);
                }
            }
        }else{
            // Point cloud: simple interleaved layout
            size_t totalFloats = binLen / 4;
            const float* floatData = (const float*) bin;
            
            if((totalFloats % 6) == 0){
                out.vertexCount = totalFloats / 6;
                out.pos = floatData;
                out.col = floatData + (out.vertexCount * 3);
            }else if((totalFloats % 3) == 0){
                out.vertexCount = totalFloats / 3;
                out.pos = floatData;
                out.col = nullptr;
            }else{
                return false;
            }
        }

        return out.pos != nullptr && out.vertexCount > 0;
    }

    struct Mat4{
        float m[16];

        static Mat4 identity(){
            Mat4 r{};
            r.m[0] = r.m[5] = r.m[10] = r.m[15] = 1.f;
            return r;
        }

        static Mat4 lookAt(
            float eyeX,
            float eyeY,
            float eyeZ,
            float cx,
            float cy,
            float cz,
            float upX,
            float upY,
            float upZ
        ){
            float fx = cx - eyeX;
            float fy = cy - eyeY;
            float fz = cz - eyeZ;
            
            float fl = std::sqrt(fx * fx + fy * fy + fz * fz);
            if(fl < 1e-20f) fl = 1.f;

            fx /= fl;
            fy /= fl;
            fz /= fl;

            float sx = fy * upZ - fz * upY;
            float sy = fz * upX - fx * upZ;
            float sz = fx * upY - fy * upX;
            
            float sl = std::sqrt(sx * sx + sy * sy + sz * sz);
            if(sl < 1e-20f) sl = 1.f;

            sx /= sl;
            sy /= sl;
            sz /= sl;

            float ux = sy * fz - sz * fy;
            float uy = sz * fx - sx * fz;
            float uz = sx * fy - sy * fx;

            Mat4 r{};
            r.m[0] = sx;
            r.m[4] = sy;
            r.m[8] = sz;
            r.m[12] = -(sx * eyeX + sy * eyeY + sz * eyeZ);

            r.m[1] = ux; 
            r.m[5] = uy;
            r.m[9] = uz;
            r.m[13] = -(ux * eyeX + uy * eyeY + uz * eyeZ);

            r.m[2] = -fx;
            r.m[6] = -fy;
            r.m[10] = -fz; 
            r.m[14] = (fx * eyeX + fy * eyeY + fz * eyeZ);

            r.m[3] = 0.f;
            r.m[7] = 0.f; 
            r.m[11] = 0.f;
            r.m[15] = 1.f;

            return r;
        }

        static Mat4 perspective(float fovRad, float aspect, float znear, float zfar){
            float f = 1.0f / std::tan(fovRad * 0.5f);
            Mat4 r{};
            r.m[0] = f / aspect;
            r.m[5] = f;
            r.m[10] = (zfar + znear) / (znear - zfar);
            r.m[11] = -1.f;
            r.m[14] = (2.f * zfar * znear) / (znear - zfar);
            return r;
        }

        Mat4 operator*(const Mat4& b) const{
            Mat4 r{};
            for(int i = 0; i < 4; i++){
                const float a0 = m[i];
                const float a1 = m[4 + i];
                const float a2 = m[8 + i];
                const float a3 = m[12 + i];

                r.m[0 * 4 + i] = a0 * b.m[0] + a1 * b.m[1] + a2 * b.m[2] + a3 * b.m[3];
                r.m[1 * 4 + i] = a0 * b.m[4] + a1 * b.m[5] + a2 * b.m[6] + a3 * b.m[7];
                r.m[2 * 4 + i] = a0 * b.m[8] + a1 * b.m[9] + a2 * b.m[10] + a3 * b.m[11];
                r.m[3 * 4 + i] = a0 * b.m[12] + a1 * b.m[13] + a2 * b.m[14] + a3 * b.m[15];
            }
            return r;
        }
    };

    struct Vec4{
        float x, y, z, w;
    };

    static inline Vec4 project4(const Mat4& mvp, float x, float y, float z){
        Vec4 r;
        r.x = mvp.m[0] * x + mvp.m[4] * y + mvp.m[8] * z + mvp.m[12];
        r.y = mvp.m[1] * x + mvp.m[5] * y + mvp.m[9] * z + mvp.m[13];
        r.z = mvp.m[2] * x + mvp.m[6] * y + mvp.m[10] * z + mvp.m[14];
        r.w = mvp.m[3] * x + mvp.m[7] * y + mvp.m[11] * z + mvp.m[15];
        return r;
    }

    static inline uint8_t toU8(float x){
        if(x < 0.f) x = 0.f;
        if(x > 1.f) x = 1.f;
        return (uint8_t)(x * 255.f + 0.5f);
    }

    struct Bounds{
        float minX, minY, minZ;
        float maxX, maxY, maxZ;
    };

    static Bounds computeBoundsParallel(const float* pos, size_t n){
        unsigned T = std::min(16u, std::max(1u, std::thread::hardware_concurrency()));
        std::vector<Bounds> b(T);
        size_t block = (n + T - 1) / T;
        
        std::vector<std::thread> threads;
        for(unsigned t = 0; t < T; t++){
            size_t start = t * block;
            size_t end = std::min(start + block, n);
            threads.emplace_back([&, t, start, end](){
                Bounds bb = {1e30f, 1e30f, 1e30f, -1e30f, -1e30f, -1e30f};
                for(size_t i = start; i < end; i++){
                    float x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
                    if(x < bb.minX) bb.minX = x;
                    if(x > bb.maxX) bb.maxX = x;

                    if(y < bb.minY) bb.minY = y; 
                    if(y > bb.maxY) bb.maxY = y;

                    if(z < bb.minZ) bb.minZ = z;
                    if(z > bb.maxZ) bb.maxZ = z;
                }
                b[t] = bb;
            });
        }

        for(auto &a : threads) a.join();

        Bounds out = b[0];
        for(unsigned t = 1; t < T; t++){
            out.minX = std::min(out.minX, b[t].minX); 
            out.maxX = std::max(out.maxX, b[t].maxX);

            out.minY = std::min(out.minY, b[t].minY);
            out.maxY = std::max(out.maxY, b[t].maxY);

            out.minZ = std::min(out.minZ, b[t].minZ);
            out.maxZ = std::max(out.maxZ, b[t].maxZ);
        }
        return out;
    }

    static void rasterizePoints(
        const float* pos,
        const float* col,
        size_t n,
        const Mat4& mvp,
        int width,
        int height,
        uint32_t* zBuffer,
        uint8_t* colorBuffer
    ){
        // Adaptive point radius based on density
        float density = (float) n / ((float) width * height);
        int pointRadius = density <= 0.1f ? 5 : (density <= 0.5f ? 4 : (density <= 1.5f ? 3 : 2));
        int r2 = pointRadius * pointRadius;

        unsigned T = std::min(16u, std::max(1u, std::thread::hardware_concurrency()));
        size_t block = (n + T - 1) / T;

        std::vector<std::thread> threads;
        for(unsigned t = 0; t < T; t++){
            size_t start = t * block;
            size_t end = std::min(start + block, n);

            threads.emplace_back([&, start, end, pointRadius, r2](){
                for(size_t i = start; i < end; i++){
                    Vec4 vec = project4(mvp, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                    if(vec.w <= 1e-6f) continue;

                    float invW = 1.f / vec.w;
                    float ndcX = vec.x * invW, ndcY = vec.y * invW, ndcZ = vec.z * invW;
                    if(ndcZ < -1.f || ndcZ > 1.f) continue;

                    int ix = (int)((ndcX * 0.5f + 0.5f) * width);
                    int iy = (int)((1.f - (ndcY * 0.5f + 0.5f)) * height);
                    if(ix < -pointRadius || ix >= width + pointRadius ||
                        iy < -pointRadius || iy >= height + pointRadius) continue;
                    
                    uint32_t z24 = (uint32_t)((ndcZ + 1.f) * 0.5f * 16777215.f);
                    uint8_t R = col ? toU8(col[i * 3]) : 180;
                    uint8_t G = col ? toU8(col[i * 3 + 1]) : 180;
                    uint8_t B = col ? toU8(col[i * 3 + 2]) : 180;
                    
                    // Draw circular splat
                    for(int dy = -pointRadius; dy <= pointRadius; dy++){
                        int yy = iy + dy;
                        if(yy < 0 || yy >= height) continue;
                        
                        for(int dx = -pointRadius; dx <= pointRadius; dx++){
                            int xx = ix + dx;
                            if(xx < 0 || xx >= width) continue;
                            
                            // Circle test
                            if(dx * dx + dy * dy > r2) continue;

                            size_t idx = yy * width + xx;
                            uint32_t oldZ = zBuffer[idx];
                            while(z24 < oldZ){
                                if(__sync_bool_compare_and_swap(&zBuffer[idx], oldZ, z24)){
                                    colorBuffer[idx * 4] = R;
                                    colorBuffer[idx * 4 + 1] = G;
                                    colorBuffer[idx * 4 + 2] = B;
                                    colorBuffer[idx * 4 + 3] = 255;
                                    break;
                                }
                                oldZ = zBuffer[idx];
                            }
                        }
                    }
                }
            });
        }

        for(auto &a : threads) a.join();
    }

    static inline float edgeFunc(float ax, float ay, float bx, float by, float cx, float cy){
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }

    static void rasterizeTriangle(
        float x0, float y0, float z0, uint8_t r0, uint8_t g0, uint8_t b0,
        float x1, float y1, float z1, uint8_t r1, uint8_t g1, uint8_t b1,
        float x2, float y2, float z2, uint8_t r2, uint8_t g2, uint8_t b2,
        int width, int height, uint32_t* zBuffer, uint8_t* colorBuffer
    ){
        float area = edgeFunc(x0, y0, x1, y1, x2, y2);
        if(area >= 0) return;
        float invArea = 1.f / area;

        int minX = std::max(0, (int)std::floor(std::min({x0, x1, x2})));
        int maxX = std::min(width - 1, (int)std::ceil(std::max({x0, x1, x2})));
        int minY = std::max(0, (int)std::floor(std::min({y0, y1, y2})));
        int maxY = std::min(height - 1, (int)std::ceil(std::max({y0, y1, y2})));

        for(int py = minY; py <= maxY; py++){
            float pyf = py + 0.5f;
            for(int px = minX; px <= maxX; px++){
                float pxf = px + 0.5f;

                float w0 = edgeFunc(x1, y1, x2, y2, pxf, pyf) * invArea;
                float w1 = edgeFunc(x2, y2, x0, y0, pxf, pyf) * invArea;
                float w2 = edgeFunc(x0, y0, x1, y1, pxf, pyf) * invArea;

                if(w0 < 0 || w1 < 0 || w2 < 0) continue;

                float z = z0 * w0 + z1 * w1 + z2 * w2;
                uint32_t z24 = (uint32_t)(z * 16777215.f);

                size_t idx = py * width + px;
                if(z24 < zBuffer[idx]){
                    zBuffer[idx] = z24;
                    colorBuffer[idx * 4] = (uint8_t)(r0 * w0 + r1 * w1 + r2 * w2);
                    colorBuffer[idx * 4 + 1] = (uint8_t)(g0 * w0 + g1 * w1 + g2 * w2);
                    colorBuffer[idx * 4 + 2] = (uint8_t)(b0 * w0 + b1 * w1 + b2 * w2);
                    colorBuffer[idx * 4 + 3] = 255;
                }
            }
        }
    }

    static void rasterizeTriangles(
        const GLBView& glb,
        const Mat4& mvp,
        int width,
        int height,
        uint32_t* zBuffer,
        uint8_t* colorBuffer
    ){
        size_t triCount = glb.indexCount / 3;
        if(triCount == 0) return;

        unsigned T = std::min(16u, std::max(1u, std::thread::hardware_concurrency()));
        size_t block = (triCount + T - 1) / T;

        std::vector<std::thread> threads;
        for(unsigned t = 0; t < T; t++){
            size_t start = t * block;
            size_t end = std::min(start + block, triCount);

            threads.emplace_back([&, start, end](){
                for(size_t tri = start; tri < end; tri++){
                    uint32_t i0, i1, i2;
                    if(glb.idx16){
                        i0 = glb.idx16[tri * 3];
                        i1 = glb.idx16[tri * 3 + 1]; 
                        i2 = glb.idx16[tri * 3 + 2];
                    }else if(glb.idx32){
                        i0 = glb.idx32[tri * 3];
                        i1 = glb.idx32[tri * 3 + 1];
                        i2 = glb.idx32[tri * 3 + 2];
                    }else{
                        continue;
                    }

                    if(i0 >= glb.vertexCount || i1 >= glb.vertexCount || i2 >= glb.vertexCount) continue;
                
                    Vec4 v0 = project4(mvp, glb.pos[i0 * 3], glb.pos[i0 * 3 + 1], glb.pos[i0 * 3 + 2]);
                    Vec4 v1 = project4(mvp, glb.pos[i1 * 3], glb.pos[i1 * 3 + 1], glb.pos[i1 * 3 + 2]);
                    Vec4 v2 = project4(mvp, glb.pos[i2 * 3], glb.pos[i2 * 3 + 1], glb.pos[i2 * 3 + 2]);

                    if(v0.w <= 1e-6f || v1.w <= 1e-6f || v2.w <= 1e-6f) continue;

                    float x0 = (v0.x / v0.w * 0.5f + 0.5f) * width;
                    float y0 = (1.f - (v0.y / v0.w * 0.5f + 0.5f)) * height;
                    float z0 = (v0.z / v0.w + 1.f) * 0.5f;

                    float x1 = (v1.x / v1.w * 0.5f + 0.5f) * width;
                    float y1 = (1.f - (v1.y / v1.w * 0.5f + 0.5f)) * height;
                    float z1 = (v1.z / v1.w + 1.f) * 0.5f;

                    float x2 = (v2.x / v2.w * 0.5f + 0.5f) * width;
                    float y2 = (1.f - (v2.y / v2.w * 0.5f + 0.5f)) * height;
                    float z2 = (v2.z / v2.w + 1.f) * 0.5f;

                    uint8_t r0 = 180, g0 = 180, b0 = 180;
                    uint8_t r1 = 180, g1 = 180, b1 = 180;
                    uint8_t r2 = 180, g2 = 180, b2 = 180;

                    if(glb.col){
                        size_t stride = glb.colorStride;
                        r0 = toU8(glb.col[i0 * stride]); 
                        g0 = toU8(glb.col[i0 * stride + 1]); 
                        b0 = toU8(glb.col[i0 * stride + 2]);

                        r1 = toU8(glb.col[i1 * stride]); 
                        g1 = toU8(glb.col[i1 * stride + 1]); 
                        b1 = toU8(glb.col[i1 * stride + 2]);

                        r2 = toU8(glb.col[i2 * stride]); 
                        g2 = toU8(glb.col[i2 * stride + 1]); 
                        b2 = toU8(glb.col[i2 * stride + 2]);
                    }

                    rasterizeTriangle(x0, y0, z0, r0, g0, b0,
                                      x1, y1, z1, r1, g1, b1,
                                      x2, y2, z2, r2, g2, b2,
                                      width, height, zBuffer, colorBuffer);
                }
            });
        }

        for(auto &a : threads) a.join();
    }
};