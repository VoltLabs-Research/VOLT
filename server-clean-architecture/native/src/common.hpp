#pragma once

#include <cstdio>
#include <cstring>
#include <cmath>
#include <cstdint>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#include "external/fast_float.h"

#define LIKELY(x)   __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)
#define ALWAYS_INLINE __attribute__((always_inline)) inline
#define HOT __attribute__((hot))
#define PREFETCH(addr) __builtin_prefetch(addr, 0, 3)
#define RESTRICT __restrict__

struct MappedFile {
    const char* data;
    size_t size;
    int fd;
    bool valid;
};

ALWAYS_INLINE MappedFile mapFile(const char* filepath) {
    MappedFile f = {nullptr, 0, -1, false};
    
    f.fd = open(filepath, O_RDONLY);
    if (UNLIKELY(f.fd < 0)) return f;
    
    struct stat sb;
    if (UNLIKELY(fstat(f.fd, &sb) < 0)) {
        close(f.fd);
        return f;
    }
    
    f.size = sb.st_size;
    if (UNLIKELY(f.size == 0)) {
        close(f.fd);
        return f;
    }
    
    f.data = (const char*)mmap(nullptr, f.size, PROT_READ, MAP_PRIVATE | MAP_NORESERVE, f.fd, 0);
    if (UNLIKELY(f.data == MAP_FAILED)) {
        close(f.fd);
        f.data = nullptr;
        return f;
    }
    
    // Advise kernel for sequential access and preload
    madvise((void*)f.data, f.size, MADV_SEQUENTIAL | MADV_WILLNEED);
    
    f.valid = true;
    return f;
}

ALWAYS_INLINE void unmapFile(MappedFile& f) {
    if (f.data) munmap((void*)f.data, f.size);
    if (f.fd >= 0) close(f.fd);
    f.valid = false;
}


HOT ALWAYS_INLINE double fastAtof(const char* RESTRICT p, const char* RESTRICT end) {
    if (UNLIKELY(p >= end)) return 0.0;
    double result = 0.0;
    auto answer = fast_float::from_chars(p, end, result);
    if (answer.ec != std::errc()) return 0.0;
    return result;
}

HOT ALWAYS_INLINE int fastAtoi(const char* RESTRICT p, const char* RESTRICT end) {
    if (UNLIKELY(p >= end)) return 0;
    
    int sign = 1;
    if (*p == '-') {
        sign = -1;
        p++;
    } else if (*p == '+') {
        p++;
    }
    
    int result = 0;
    while (p < end) {
        unsigned int d = (unsigned int)(*p - '0');
        if (d > 9) break;
        result = result * 10 + d;
        p++;
    }
    
    return sign * result;
}

HOT ALWAYS_INLINE const char* skipWhitespace(const char* RESTRICT p, const char* RESTRICT end) {
    // Unrolled loop for common case
    while (p < end && *p <= ' ') p++;
    return p;
}

HOT ALWAYS_INLINE const char* findTokenEnd(const char* RESTRICT p, const char* RESTRICT end) {
    while (p < end && *p > ' ') p++;
    return p;
}

ALWAYS_INLINE const char* jumpToNextLine(const char* RESTRICT p, const char* RESTRICT end) {
    // Use memchr for cache-efficient line finding
    const char* nl = (const char*)memchr(p, '\n', end - p);
    return nl ? nl + 1 : end;
}

ALWAYS_INLINE const char* findLineEnd(const char* RESTRICT p, const char* RESTRICT end) {
    const char* nl = (const char*)memchr(p, '\n', end - p);
    return nl ? nl : end;
}

struct alignas(16) BoundingBox {
    float minX, minY, minZ, _pad1;
    float maxX, maxY, maxZ, _pad2;
    
    void init() {
        minX = minY = minZ = 1e30f;
        maxX = maxY = maxZ = -1e30f;
    }
    
    HOT ALWAYS_INLINE void update(float x, float y, float z) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
    }
    
    void merge(const BoundingBox& other) {
        if (other.minX < minX) minX = other.minX;
        if (other.maxX > maxX) maxX = other.maxX;
        if (other.minY < minY) minY = other.minY;
        if (other.maxY > maxY) maxY = other.maxY;
        if (other.minZ < minZ) minZ = other.minZ;
        if (other.maxZ > maxZ) maxZ = other.maxZ;
    }
};

struct SimulationBox {
    double xlo, xhi;
    double ylo, yhi;
    double zlo, zhi;
};

struct ColumnMapping {
    int idxId = -1;
    int idxType = -1;
    int idxX = -1;
    int idxY = -1;
    int idxZ = -1;
    int maxIdx = 0;
    
    void computeMaxIdx() {
        maxIdx = idxType;
        if (idxX > maxIdx) maxIdx = idxX;
        if (idxY > maxIdx) maxIdx = idxY;
        if (idxZ > maxIdx) maxIdx = idxZ;
        if (idxId > maxIdx) maxIdx = idxId;
    }
};

ALWAYS_INLINE void detectDataColumnStyle(int colCount, ColumnMapping& cols) {
    cols.idxId = 0;
    
    if (colCount >= 7) {
        // Full: id mol type charge x y z
        cols.idxType = 2;
        cols.idxX = 4;
        cols.idxY = 5;
        cols.idxZ = 6;
    } else if (colCount == 6) {
        // Charge: id type charge x y z
        cols.idxType = 1;
        cols.idxX = 3;
        cols.idxY = 4;
        cols.idxZ = 5;
    } else {
        // Atomic: id type x y z (default)
        cols.idxType = 1;
        cols.idxX = 2;
        cols.idxY = 3;
        cols.idxZ = 4;
    }
    cols.computeMaxIdx();
}
