#include <opendxa/core/lammps_parser.h>
#include <algorithm>
#include <numeric>
#include <thread>
#include <future>
#include <cmath>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <fast_float/fast_float.h>

// SIMD 
#if defined(__AVX2__)
    #include <immintrin.h>
    #define HAS_AVX2 1
#elif defined(__SSE2__)
    #include <emmintrin.h>
    #define HAS_SSE2 1
#endif

namespace OpenDXA{

// Compiler hints
#define LIKELY(x) __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)
#define RESTRICT __restrict__
#define HOT __attribute__((hot))


bool LammpsParser::MappedFile::open(const char* path){
    fd = ::open(path, O_RDONLY);
    if(fd < 0) return false;

    struct stat st;
    if(fstat(fd, &st) < 0){
        ::close(fd);
        fd = -1;
        return false;
    }

    size = static_cast<size_t>(st.st_size);
    if(size == 0){
        ::close(fd);
        fd = -1;
        return false;
    }

    data = static_cast<const char*>(mmap(nullptr, size, PROT_READ, MAP_PRIVATE | MAP_POPULATE, fd, 0));
    if(data == MAP_FAILED){
        data = nullptr;
        ::close(fd);
        fd = -1;
        return false;
    }

    // advise kernel for sequential access
    madvise(const_cast<char*>(data), size, MADV_SEQUENTIAL|  MADV_WILLNEED);

    valid = true;
    return true;
}

void LammpsParser::MappedFile::close(){
    if(data && data != MAP_FAILED){
        munmap(const_cast<char*>(data), size);
    }

    if(fd >= 0){
        ::close(fd);
    }

    data = nullptr;
    size = 0;
    fd = -1;
    valid = false;
}

HOT static inline const char* findLineEnd(const char* RESTRICT p, const char* RESTRICT end){
#if HAS_AVX2
    // Process 32 bytes at a time with AVX2
    const __m256i nl = _mm256_set1_epi8('\n');
    while(p + 32 <= end){
        __m256i chunk = _mm256_loadu_si256(reinterpret_cast<const __m256i*>(p));
        __m256i cmp = _mm256_cmpeq_epi8(chunk, nl);
        int mask = _mm256_movemask_epi8(cmp);
        if(mask){
            return p + __builtin_ctz(mask);
        }
        p += 32;
    }
#endif
    // scalar fallback
    while(p < end && *p != '\n') ++p;
    return p;
}

HOT static inline const char* skipWhitespace(const char* RESTRICT p, const char* RESTRICT end){
    while(p < end && (*p == ' ' || *p == '\t')) ++p;
    return p;
}

HOT static inline const char* findTokenEnd(const char* RESTRICT p, const char* RESTRICT end){
    while(p < end && *p != ' ' && *p != '\t' && *p != '\n' && *p != '\r') ++p;
    return p;
}

static inline const char* jumpToNextLine(const char* p, const char* end){
    p = findLineEnd(p, end);
    if(p < end && *p == '\n') p++;
    return p;
}

HOT static inline int fastAtoi(const char* RESTRICT p, const char* RESTRICT end){
    int x = 0;
    bool neg = false;
    if(UNLIKELY(p >= end)) return 0;
    if(*p == '-'){
        neg = true;
        ++p;
    }

    // Unrolled loop for common case (1-8 digits)
    while(p < end && *p >= '0' && *p <= '9'){
        x = x * 10 + (*p - '0');
        ++p;
    }

    return neg ? -x : x;
}

HOT static inline double fastAtof(const char* RESTRICT p, const char* RESTRICT end){
    double val = 0.0;
    auto result = fast_float::from_chars(p, end, val);
    (void) result;
    return val;
}

bool LammpsParser::parseHeader(const char*& p, const char* end, Frame &f, ColumnMapping &cols){
    // bitmask: 1 = timestep, 2 = natoms, 4 = bounds, 8 = atoms
    uint8_t found = 0;
    while(p < end && found != 15){
        const char* lineEnd = findLineEnd(p, end);
        const char* content = skipWhitespace(p, lineEnd);

        if(UNLIKELY(content >= lineEnd)){
            p = lineEnd + 1;
            continue;
        }

        if(lineEnd - content >= 5 && content[0] == 'I' && content[4] == ':'){
            // Skip "ITEM:"
            content += 6;
            
            if(!(found & 1) && std::strncmp(content, "TIMESTEP", 8) == 0){
                p = lineEnd + 1;
                const char* valEnd = findLineEnd(p, end);
                f.timestep = fastAtoi(skipWhitespace(p, valEnd), valEnd);
                found |= 1;
                p = valEnd;
            }else if(!(found & 2) && std::strncmp(content, "NUMBER OF ATOMS", 15) == 0){
                p = lineEnd + 1;
                const char* valEnd = findLineEnd(p, end);
                f.natoms = fastAtoi(skipWhitespace(p, valEnd), valEnd);
                found |= 2;
                
                // Pre-allocate all memory upfront
                f.positions.resize(f.natoms);
                f.types.resize(f.natoms);
                f.ids.resize(f.natoms);
                
                p = valEnd;
            }  else if (!(found & 4) && std::strncmp(content, "BOX BOUNDS", 10) == 0) {
                // Parse PBC flags from header
                bool pbcX = true, pbcY = true, pbcZ = true;
                const char* hp = content + 10;
                while(hp < lineEnd){
                    const char* tokEnd = findTokenEnd(hp, lineEnd);
                    if(tokEnd - hp == 2){
                        if (hp[0] == 'p' && hp[1] == 'p'){
                            // Already true
                        }else{
                            // Check position
                            const char* scan = content + 10;
                            int idx = 0;
                            while(scan < hp){
                                scan = findTokenEnd(scan, lineEnd);
                                scan = skipWhitespace(scan, lineEnd);
                                idx++;
                            }
                            if (idx == 0) pbcX = false;
                            else if (idx == 1) pbcY = false;
                            else if (idx == 2) pbcZ = false;
                        }
                    }
                    hp = skipWhitespace(tokEnd, lineEnd);
                }

                // parse 3 lines of box bounds
                double lo[3], hi[3], tilt[3] = {0.0, 0.0, 0.0};
                for(int i = 0; i < 3 && p < end; i++){
                    p = lineEnd + 1;
                    lineEnd = findLineEnd(p, end);
                    
                    const char* bp = skipWhitespace(p, lineEnd);
                    const char* tokEnd = findTokenEnd(bp, lineEnd);
                    lo[i] = fastAtof(bp, tokEnd);
                    
                    bp = skipWhitespace(tokEnd, lineEnd);
                    tokEnd = findTokenEnd(bp, lineEnd);
                    hi[i] = fastAtof(bp, tokEnd);
                    
                    // Check for tilt factor
                    bp = skipWhitespace(tokEnd, lineEnd);
                    if(bp < lineEnd){
                        tokEnd = findTokenEnd(bp, lineEnd);
                        tilt[i] = fastAtof(bp, tokEnd);
                    }
                }
                
                // Build simulation cell
                Point3 minc(lo[0], lo[1], lo[2]);
                Point3 maxc(hi[0], hi[1], hi[2]);
                
                double t0 = tilt[0], t1 = tilt[1];
                double dxmin = std::min({t0, t1, t0 + t1, 0.0});
                double dxmax = std::max({t0, t1, t0 + t1, 0.0});
                minc.x() -= dxmin;
                maxc.x() -= dxmax;
                
                double t2 = tilt[2];
                minc.y() -= std::min(t2, 0.0);
                maxc.y() -= std::max(t2, 0.0);
                
                Vector3 a(maxc.x() - minc.x(), 0.0, 0.0);
                Vector3 b(tilt[0], maxc.y() - minc.y(), 0.0);
                Vector3 c(tilt[1], tilt[2], maxc.z() - minc.z());
                
                AffineTransformation M(a, b, c, minc - Point3::Origin());
                f.simulationCell.setMatrix(M);
                f.simulationCell.setPbcFlags(pbcX, pbcY, pbcZ);
                
                found |= 4;
            }else if(!(found & 8) && std::strncmp(content, "ATOMS", 5) == 0){
                // Parse column headers
                const char* hp = content + 5;
                hp = skipWhitespace(hp, lineEnd);
                
                int colIdx = 0;
                while(hp < lineEnd){
                    const char* tokEnd = findTokenEnd(hp, lineEnd);
                    size_t len = tokEnd - hp;
                    
                    // Convert first char to lowercase for comparison
                    char c0 = (hp[0] >= 'A' && hp[0] <= 'Z') ? hp[0] + 32 : hp[0];
                    
                    if(len == 4 && c0 == 't' && (hp[1] == 'y' || hp[1] == 'Y')){
                        cols.idxType = colIdx;
                    }else if(len == 2 && c0 == 'i' && (hp[1] == 'd' || hp[1] == 'D')){
                        cols.idxId = colIdx;
                    }else if(len == 1){
                        if(c0 == 'x') cols.idxX = colIdx;
                        else if(c0 == 'y') cols.idxY = colIdx;
                        else if(c0 == 'z') cols.idxZ = colIdx;
                    }else if(len == 2){
                        char c1 = (hp[1] >= 'A' && hp[1] <= 'Z') ? hp[1] + 32 : hp[1];
                        if(c0 == 'x' && c1 == 's') cols.idxXs = colIdx;
                        else if(c0 == 'y' && c1 == 's') cols.idxYs = colIdx;
                        else if(c0 == 'z' && c1 == 's') cols.idxZs = colIdx;
                    }
                    
                    hp = skipWhitespace(tokEnd, lineEnd);
                    colIdx++;
                }
                
                cols.computeMaxIdx();
                // Point to start of atom data
                p = lineEnd + 1;
                found |= 8;
                // Header complete
                return true;
            }
        }

        p = lineEnd + 1;
    }

    // Validate required columns
    bool hasCoords = (cols.idxX >= 0 && cols.idxY >= 0 && cols.idxZ >= 0) ||
                    (cols.idxXs >= 0 && cols.idxYs >= 0 && cols.idxZs >= 0);
    
    return (found == 15) && cols.idxType >= 0 && hasCoords;
}

HOT void LammpsParser::parseAtomChunk(
    const char* RESTRICT start,
    const char* RESTRICT chunkEnd,
    const char* RESTRICT globalEnd,
    Point3* RESTRICT positions,
    int* RESTRICT types,
    int* RESTRICT ids,
    int startIdx,
    const ColumnMapping& cols,
    const AffineTransformation* cellMatrix
){
    const char* p = start;
    int atomIdx = startIdx;

    const int maxCol = cols.maxIdx;
    const bool scaled = cols.hasScaled();

    // Determine which column indices to use
    const int xCol = scaled ? cols.idxXs : cols.idxX;
    const int yCol = scaled ? cols.idxYs : cols.idxY;
    const int zCol = scaled ? cols.idxZs : cols.idxZ;

    while(p < chunkEnd){
        const char* lineEnd = findLineEnd(p, globalEnd);
        const char* content = skipWhitespace(p, lineEnd);

        // Skip empty lines
        if(UNLIKELY(content >= lineEnd)){
            p = lineEnd + 1;
            continue;
        }
        // Stop at next ITEM: section
        if (UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')) {
            break;
        }
        
        // Parse atom data
        double px = 0, py = 0, pz = 0;
        int type = 1;
        int id = atomIdx + 1;
        
        const char* tok = content;
        int col = 0;
        
        // Parse all tokens up to maxCol
        while(tok < lineEnd && col <= maxCol){
            const char* tokEnd = findTokenEnd(tok, lineEnd);
            
            if(col == xCol){
                px = fastAtof(tok, tokEnd);
            }else if(col == yCol){
                py = fastAtof(tok, tokEnd);
            }else if(col == zCol){
                pz = fastAtof(tok, tokEnd);
            }else if(col == cols.idxType){
                type = fastAtoi(tok, tokEnd);
            }else if(col == cols.idxId){
                id = fastAtoi(tok, tokEnd);
            }
            
            tok = skipWhitespace(tokEnd, lineEnd);
            col++;
        }
        
        // Convert scaled to Cartesian if needed
        if(scaled && cellMatrix){
            Point3 frac(px, py, pz);
            Point3 cart = (*cellMatrix) * frac;
            px = cart.x();
            py = cart.y();
            pz = cart.z();
        }
        
        // Write directly to pre-allocated arrays
        positions[atomIdx] = Point3(px, py, pz);
        types[atomIdx] = type;
        ids[atomIdx] = id;
        
        atomIdx++;
        p = lineEnd + 1;
    }
}

// Count atoms in a chunk (for calculating offsets in a multi-threaded mode)
static int countAtomsInChunk(const char* start, const char* end, const char* globalEnd){
    int count = 0;
    const char* p = start;
    
    while(p < end){
        const char* lineEnd = findLineEnd(p, globalEnd);
        const char* content = skipWhitespace(p, lineEnd);

        if(content < lineEnd){
            if(UNLIKELY(content[0] == 'I' && lineEnd - content >= 5 && content[4] == ':')){
                break;
            }
        }

        p = lineEnd + 1;
    }

    return count;
}

bool LammpsParser::parseFile(const std::string& filename, Frame &frame, const ParseOptions &opts){
    // Memory-map the file
    MappedFile file;
    if(!file.open(filename.c_str())){
        spdlog::error("Failed to open file: {}", filename);
        return false;
    }

    // Parse header
    ColumnMapping cols;
    const char* p = file.data;
    const char* end = file.data + file.size;

    if(!parseHeader(p, end, frame, cols)){
        file.close();
        spdlog::error("Invalid LAMMPS dump format in: {}", filename);
        return false;
    }

    // Get cell matrix for scaled coordinates
    const AffineTransformation* cellMatrix = cols.hasScaled() ? &frame.simulationCell.matrix() : nullptr;

    unsigned numThreads = opts.numThreads;
    if(numThreads == 0){
        numThreads = std::thread::hardware_concurrency();
        if(numThreads == 0) numThreads = 1;
    }

    // NOTE: for small files, single-threaded is faster (avoid thread overhead)
    if(frame.natoms < 50000) numThreads = 1;

    const char* dataStart = p;
    const char* dataEnd = end;

    if(numThreads == 1){
        parseAtomChunk(dataStart, dataEnd, dataEnd, frame.positions.data(), frame.types.data(), frame.ids.data(), 0, cols, cellMatrix);
    }else{
        // multi-threaded parsing
        size_t chunkSize = (dataEnd - dataStart) / numThreads;
        std::vector<const char*> chunkPtrs(numThreads + 1);
        chunkPtrs[0] = dataStart;
        chunkPtrs[numThreads] = dataEnd;

        // find line boundaries for each chunk
        for(unsigned i = 1; i < numThreads; i++){
            const char* split = dataStart + i * chunkSize;
            chunkPtrs[i] = jumpToNextLine(split, dataEnd);
        }

        // count atoms per chunk to calculate offsets
        std::vector<std::future<int>> countFutures;
        countFutures.reserve(numThreads);
        for(unsigned i = 0; i < numThreads; i++){
            countFutures.push_back(std::async(std::launch::async, countAtomsInChunk, chunkPtrs[i], chunkPtrs[i + 1], dataEnd));
        }

        std::vector<int> offsets(numThreads, 0);
        int running = 0;
        for(unsigned i = 0; i < numThreads; i++){
            offsets[i] = running;
            running += countFutures[i].get();
        }

        // launch parser threads
        std::vector<std::thread> threads;
        threads.reserve(numThreads);
        for(unsigned i = 0; i < numThreads; i++){
            threads.emplace_back(&LammpsParser::parseAtomChunk, this, chunkPtrs[i], chunkPtrs[i + 1], 
                dataEnd, frame.positions.data(), frame.types.data(), frame.ids.data(), offsets[i], cols, cellMatrix);
        }

        for(auto &t : threads) t.join();
    }

    file.close();

    spdlog::debug("Parsed {} atoms at timestep {} (fast path)", frame.natoms, frame.timestep);

    return true;
}

}