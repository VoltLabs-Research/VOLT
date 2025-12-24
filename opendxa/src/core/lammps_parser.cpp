#include <opendxa/core/lammps_parser.h>
#include <algorithm>
#include <atomic>
#include <cstring>
#include <numeric>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>
#include <fast_float/fast_float.h>

#include <omp.h>

#if defined(__unix__) || defined(__APPLE__)
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace OpenDXA{

namespace {

struct LineView{
    const char* begin = nullptr;
    const char* end = nullptr;
};

inline bool readLine(const char*& cursor, const char* end, LineView& line){
    if(cursor >= end) return false;
    const char* lineEnd = static_cast<const char*>(std::memchr(cursor, '\n', end - cursor));
    if(lineEnd){
        line.begin = cursor;
        line.end = lineEnd;
        cursor = lineEnd + 1;
    }else{
        line.begin = cursor;
        line.end = end;
        cursor = end;
    }
    if(line.end > line.begin && *(line.end - 1) == '\r'){
        --line.end;
    }
    return true;
}

inline bool lineStartsWith(const LineView& line, const char* prefix){
    size_t len = std::strlen(prefix);
    return (static_cast<size_t>(line.end - line.begin) >= len) &&
           (std::memcmp(line.begin, prefix, len) == 0);
}

inline const char* skipSpaces(const char* p, const char* end){
    while(p < end && (*p == ' ' || *p == '\t')) ++p;
    return p;
}

inline const char* skipToken(const char* p, const char* end){
    while(p < end && *p != ' ' && *p != '\t' && *p != '\n' && *p != '\r') ++p;
    return p;
}

inline bool parseIntToken(const char* start, const char* end, int& out){
    if(start >= end) return false;
    int sign = 1;
    if(*start == '-'){
        sign = -1;
        ++start;
    }
    int value = 0;
    bool any = false;
    for(const char* p = start; p < end; ++p){
        char c = *p;
        if(c < '0' || c > '9') break;
        value = value * 10 + (c - '0');
        any = true;
    }
    if(!any) return false;
    out = value * sign;
    return true;
}

inline bool parseDoubleToken(const char* start, const char* end, double& out){
    auto result = fast_float::from_chars(start, end, out);
    return result.ec == std::errc();
}

inline bool parseIntLine(const LineView& line, int& out){
    const char* p = skipSpaces(line.begin, line.end);
    return parseIntToken(p, line.end, out);
}

inline bool nextDoubleToken(const char*& p, const char* end, double& out){
    p = skipSpaces(p, end);
    if(p >= end) return false;
    const char* start = p;
    p = skipToken(p, end);
    return parseDoubleToken(start, p, out);
}

inline bool parseBoundsLine(const LineView& line, double& lo, double& hi, double& tilt){
    const char* p = line.begin;
    if(!nextDoubleToken(p, line.end, lo)) return false;
    if(!nextDoubleToken(p, line.end, hi)) return false;
    if(!nextDoubleToken(p, line.end, tilt)) tilt = 0.0;
    return true;
}

inline void parseBoxFlags(const LineView& line, bool& pbcX, bool& pbcY, bool& pbcZ){
    pbcX = pbcY = pbcZ = true;
    std::string_view last[3] = {};
    int tokenCount = 0;
    const char* p = line.begin;
    while(p < line.end){
        p = skipSpaces(p, line.end);
        if(p >= line.end) break;
        const char* start = p;
        p = skipToken(p, line.end);
        std::string_view tok(start, static_cast<size_t>(p - start));
        if(tokenCount >= 3){
            last[0] = last[1];
            last[1] = last[2];
            last[2] = tok;
        }else{
            last[tokenCount] = tok;
        }
        ++tokenCount;
    }
    if(tokenCount >= 6){
        pbcX = (last[0] == "pp");
        pbcY = (last[1] == "pp");
        pbcZ = (last[2] == "pp");
    }
}

enum class ColumnKind : unsigned char{
    Ignore,
    Id,
    Type,
    PosX,
    PosY,
    PosZ
};

struct AtomColumns{
    int idCol = -1;
    int typeCol = -1;
    int xCol = -1;
    int yCol = -1;
    int zCol = -1;
    int xsCol = -1;
    int ysCol = -1;
    int zsCol = -1;
    int posXCol = -1;
    int posYCol = -1;
    int posZCol = -1;
    bool scaled = false;
    bool valid = false;
    std::vector<ColumnKind> kinds;
};

inline AtomColumns parseAtomColumns(const LineView& line){
    AtomColumns cols;
    int tokenIndex = 0;
    int columnIndex = 0;
    const char* p = line.begin;
    while(p < line.end){
        p = skipSpaces(p, line.end);
        if(p >= line.end) break;
        const char* start = p;
        p = skipToken(p, line.end);
        if(tokenIndex >= 2){
            std::string_view tok(start, static_cast<size_t>(p - start));
            if(tok == "id") cols.idCol = columnIndex;
            else if(tok == "type") cols.typeCol = columnIndex;
            else if(tok == "x") cols.xCol = columnIndex;
            else if(tok == "y") cols.yCol = columnIndex;
            else if(tok == "z") cols.zCol = columnIndex;
            else if(tok == "xs") cols.xsCol = columnIndex;
            else if(tok == "ys") cols.ysCol = columnIndex;
            else if(tok == "zs") cols.zsCol = columnIndex;
            ++columnIndex;
        }
        ++tokenIndex;
    }

    cols.scaled = (cols.xsCol >= 0 && cols.ysCol >= 0 && cols.zsCol >= 0);
    cols.posXCol = cols.scaled ? cols.xsCol : cols.xCol;
    cols.posYCol = cols.scaled ? cols.ysCol : cols.yCol;
    cols.posZCol = cols.scaled ? cols.zsCol : cols.zCol;
    cols.valid = (cols.posXCol >= 0 && cols.posYCol >= 0 && cols.posZCol >= 0);
    cols.kinds.assign(static_cast<size_t>(columnIndex), ColumnKind::Ignore);

    if(cols.idCol >= 0) cols.kinds[cols.idCol] = ColumnKind::Id;
    if(cols.typeCol >= 0) cols.kinds[cols.typeCol] = ColumnKind::Type;
    if(cols.posXCol >= 0) cols.kinds[cols.posXCol] = ColumnKind::PosX;
    if(cols.posYCol >= 0) cols.kinds[cols.posYCol] = ColumnKind::PosY;
    if(cols.posZCol >= 0) cols.kinds[cols.posZCol] = ColumnKind::PosZ;

    return cols;
}

struct CellMatrix{
    double m00, m01, m02, m03;
    double m10, m11, m12, m13;
    double m20, m21, m22, m23;
};

inline const char* advanceLines(const char* p, const char* end, size_t lines, bool& ok){
    size_t count = 0;
    while(count < lines && p < end){
        const char* nl = static_cast<const char*>(std::memchr(p, '\n', end - p));
        if(nl){
            p = nl + 1;
            ++count;
        }else{
            ++count;
            p = end;
            break;
        }
    }
    ok = (count == lines);
    return p;
}

inline size_t countNewlines(const char* p, const char* end){
    size_t count = 0;
    while(p < end){
        const char* nl = static_cast<const char*>(std::memchr(p, '\n', end - p));
        if(!nl) break;
        ++count;
        p = nl + 1;
    }
    return count;
}

inline int resolveThreads(){
    int threads = static_cast<int>(std::thread::hardware_concurrency());
    if(threads <= 0){
        threads = 1;
    }
    omp_set_dynamic(0);
    omp_set_num_threads(threads);
    return threads;
}

inline const char* parseAtomLine(
    const char* p,
    const char* end,
    const AtomColumns& cols,
    const CellMatrix& cell,
    LammpsParser::Frame& frame,
    size_t index,
    bool& ok
){
    int id = cols.idCol >= 0 ? 0 : static_cast<int>(index + 1);
    int type = cols.typeCol >= 0 ? 0 : 1;
    bool idSet = cols.idCol < 0;
    bool typeSet = cols.typeCol < 0;
    bool xSet = false;
    bool ySet = false;
    bool zSet = false;
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
    int col = 0;

    while(p < end){
        char c = *p;
        if(c == '\n'){
            ++p;
            break;
        }
        if(c == '\r'){
            ++p;
            continue;
        }
        if(c == ' ' || c == '\t'){
            ++p;
            continue;
        }

        const char* tokenStart = p;
        while(p < end){
            char cc = *p;
            if(cc == ' ' || cc == '\t' || cc == '\n' || cc == '\r') break;
            ++p;
        }
        const char* tokenEnd = p;

        if(col < static_cast<int>(cols.kinds.size())){
            switch(cols.kinds[col]){
                case ColumnKind::Id:
                    if(!parseIntToken(tokenStart, tokenEnd, id)) ok = false;
                    else idSet = true;
                    break;
                case ColumnKind::Type:
                    if(!parseIntToken(tokenStart, tokenEnd, type)) ok = false;
                    else typeSet = true;
                    break;
                case ColumnKind::PosX:
                    if(!parseDoubleToken(tokenStart, tokenEnd, x)) ok = false;
                    else xSet = true;
                    break;
                case ColumnKind::PosY:
                    if(!parseDoubleToken(tokenStart, tokenEnd, y)) ok = false;
                    else ySet = true;
                    break;
                case ColumnKind::PosZ:
                    if(!parseDoubleToken(tokenStart, tokenEnd, z)) ok = false;
                    else zSet = true;
                    break;
                default:
                    break;
            }
        }
        ++col;
    }

    if(!idSet || !typeSet || !xSet || !ySet || !zSet){
        ok = false;
        return p;
    }

    if(cols.scaled){
        const double px = cell.m00 * x + cell.m01 * y + cell.m02 * z + cell.m03;
        const double py = cell.m10 * x + cell.m11 * y + cell.m12 * z + cell.m13;
        const double pz = cell.m20 * x + cell.m21 * y + cell.m22 * z + cell.m23;
        frame.positions[index] = Point3(px, py, pz);
    }else{
        frame.positions[index] = Point3(x, y, z);
    }

    frame.ids[index] = id;
    frame.types[index] = type;
    return p;
}

#if defined(__unix__) || defined(__APPLE__)
class MappedFile{
public:
    explicit MappedFile(const std::string& filename){
        fd_ = open(filename.c_str(), O_RDONLY);
        if(fd_ < 0) return;

        struct stat st{};
        if(fstat(fd_, &st) != 0 || st.st_size <= 0){
            close(fd_);
            fd_ = -1;
            return;
        }
        size_ = static_cast<size_t>(st.st_size);
        data_ = static_cast<const char*>(mmap(nullptr, size_, PROT_READ, MAP_PRIVATE, fd_, 0));
        if(data_ == MAP_FAILED){
            data_ = nullptr;
            close(fd_);
            fd_ = -1;
            return;
        }
#ifdef POSIX_FADV_SEQUENTIAL
        posix_fadvise(fd_, 0, 0, POSIX_FADV_SEQUENTIAL);
#endif
#ifdef MADV_SEQUENTIAL
        madvise(const_cast<char*>(data_), size_, MADV_SEQUENTIAL);
#endif
#ifdef MADV_WILLNEED
        madvise(const_cast<char*>(data_), size_, MADV_WILLNEED);
#endif
        valid_ = true;
    }

    ~MappedFile(){
        if(data_){
            munmap(const_cast<char*>(data_), size_);
        }
        if(fd_ >= 0){
            close(fd_);
        }
    }

    bool valid() const { return valid_; }
    const char* data() const { return data_; }
    size_t size() const { return size_; }

private:
    int fd_ = -1;
    const char* data_ = nullptr;
    size_t size_ = 0;
    bool valid_ = false;
};
#endif

inline bool parseMapped(const char* data, size_t size, LammpsParser::Frame& frame){
    const char* cursor = data;
    const char* end = data + size;
    LineView line;

    if(!readLine(cursor, end, line) || !lineStartsWith(line, "ITEM: TIMESTEP")) return false;
    if(!readLine(cursor, end, line) || !parseIntLine(line, frame.timestep)) return false;
    if(!readLine(cursor, end, line) || !lineStartsWith(line, "ITEM: NUMBER OF ATOMS")) return false;
    if(!readLine(cursor, end, line) || !parseIntLine(line, frame.natoms)) return false;

    if(frame.natoms <= 0) return false;
    frame.positions.resize(frame.natoms);
    frame.types.resize(frame.natoms);
    frame.ids.resize(frame.natoms);

    if(!readLine(cursor, end, line) || !lineStartsWith(line, "ITEM: BOX BOUNDS")) return false;
    bool pbcX = true, pbcY = true, pbcZ = true;
    parseBoxFlags(line, pbcX, pbcY, pbcZ);

    double lo[3], hi[3], tilt[3];
    for(int i = 0; i < 3; ++i){
        if(!readLine(cursor, end, line)) return false;
        if(!parseBoundsLine(line, lo[i], hi[i], tilt[i])) return false;
    }

    Point3 minc(lo[0], lo[1], lo[2]);
    Point3 maxc(hi[0], hi[1], hi[2]);

    double t0 = tilt[0], t1 = tilt[1];
    double dxmin = std::min({ t0, t1, t0 + t1, 0.0 });
    double dxmax = std::max({ t0, t1, t0 + t1, 0.0 });
    minc.x() -= dxmin;
    maxc.x() -= dxmax;

    double t2 = tilt[2];
    minc.y() -= std::min(t2, 0.0);
    maxc.y() -= std::max(t2, 0.0);

    Vector3 a(maxc.x() - minc.x(), 0.0, 0.0);
    Vector3 b(tilt[0], maxc.y() - minc.y(), 0.0);
    Vector3 c(tilt[1], tilt[2], maxc.z() - minc.z());
    Point3 origin = minc;

    AffineTransformation M(a, b, c, origin - Point3::Origin());
    frame.simulationCell.setMatrix(M);
    frame.simulationCell.setPbcFlags(pbcX, pbcY, pbcZ);

    if(!readLine(cursor, end, line) || !lineStartsWith(line, "ITEM: ATOMS")) return false;
    AtomColumns cols = parseAtomColumns(line);
    if(!cols.valid) return false;

    CellMatrix cell{};
    if(cols.scaled){
        const auto& mat = frame.simulationCell.matrix();
        const auto& c0 = mat.column(0);
        const auto& c1 = mat.column(1);
        const auto& c2 = mat.column(2);
        const auto& c3 = mat.column(3);
        cell.m00 = c0.x(); cell.m01 = c1.x(); cell.m02 = c2.x(); cell.m03 = c3.x();
        cell.m10 = c0.y(); cell.m11 = c1.y(); cell.m12 = c2.y(); cell.m13 = c3.y();
        cell.m20 = c0.z(); cell.m21 = c1.z(); cell.m22 = c2.z(); cell.m23 = c3.z();
    }

    const char* atomBegin = cursor;
    bool okLines = false;
    const char* atomEnd = advanceLines(atomBegin, end, static_cast<size_t>(frame.natoms), okLines);
    if(!okLines) return false;

    int threads = resolveThreads();
    if(threads <= 1){
        const char* p = atomBegin;
        for(size_t i = 0; i < static_cast<size_t>(frame.natoms); ++i){
            bool ok = true;
            p = parseAtomLine(p, atomEnd, cols, cell, frame, i, ok);
            if(!ok) return false;
        }
    }else{
        size_t totalBytes = static_cast<size_t>(atomEnd - atomBegin);
        std::vector<const char*> chunkStarts(static_cast<size_t>(threads + 1));
        chunkStarts[0] = atomBegin;
        chunkStarts[threads] = atomEnd;

        for(int i = 1; i < threads; ++i){
            const char* approx = atomBegin + (totalBytes * static_cast<size_t>(i)) / static_cast<size_t>(threads);
            if(approx > atomBegin && *(approx - 1) == '\n'){
                chunkStarts[i] = approx;
            }else{
                const char* nl = static_cast<const char*>(std::memchr(approx, '\n', atomEnd - approx));
                chunkStarts[i] = nl ? (nl + 1) : atomEnd;
            }
        }

        std::vector<size_t> counts(static_cast<size_t>(threads), 0);
#pragma omp parallel for schedule(static)
        for(int i = 0; i < threads; ++i){
            counts[static_cast<size_t>(i)] = countNewlines(chunkStarts[i], chunkStarts[i + 1]);
        }

        size_t totalLines = std::accumulate(counts.begin(), counts.end(), static_cast<size_t>(0));
        if(totalLines < static_cast<size_t>(frame.natoms)){
            if(atomEnd == end && atomEnd > atomBegin && *(atomEnd - 1) != '\n' &&
               (static_cast<size_t>(frame.natoms) - totalLines) == 1){
                counts.back() += 1;
                ++totalLines;
            }
        }

        if(totalLines != static_cast<size_t>(frame.natoms)) return false;

        std::vector<size_t> offsets(static_cast<size_t>(threads + 1), 0);
        for(int i = 0; i < threads; ++i){
            offsets[static_cast<size_t>(i + 1)] = offsets[static_cast<size_t>(i)] + counts[static_cast<size_t>(i)];
        }

        std::atomic<bool> parseFailed(false);
#pragma omp parallel for schedule(static)
        for(int i = 0; i < threads; ++i){
            if(parseFailed.load(std::memory_order_relaxed)) continue;
            const char* p = chunkStarts[i];
            const char* chunkEnd = chunkStarts[i + 1];
            size_t index = offsets[static_cast<size_t>(i)];
            size_t lines = counts[static_cast<size_t>(i)];
            for(size_t lineIdx = 0; lineIdx < lines; ++lineIdx){
                if(parseFailed.load(std::memory_order_relaxed)) break;
                bool ok = true;
                p = parseAtomLine(p, chunkEnd, cols, cell, frame, index, ok);
                if(!ok){
                    parseFailed.store(true, std::memory_order_relaxed);
                    break;
                }
                ++index;
            }
        }

        if(parseFailed.load(std::memory_order_relaxed)) return false;
    }

    return true;
}

} // namespace

// Parse a LAMMPS dump file into a Frame structure.
// Opens the given filename for input and hands the resulting stream to parseStream().
// If the file cannot be opened, reports an error and returns false.
bool LammpsParser::parseFile(const std::string &filename, Frame &frame){
#if defined(__unix__) || defined(__APPLE__)
    MappedFile mapped(filename);
    if(mapped.valid()){
        return parseMapped(mapped.data(), mapped.size(), frame);
    }
#endif

    std::ifstream file(filename, std::ios::binary);
    if(!file.is_open()){
        std::cerr << "Error: cannot open file " << filename << std::endl;
        return false;
    }

    return parseStream(file, frame);
}

// Parse a LAMMPS dump from any input stream.
// Return header lines, box bounds, and atom data in sequence.
// If any stage fails, the function aborts and returns false.
bool LammpsParser::parseStream(std::istream &in, Frame &frame){
    if(!readHeader(in, frame)) return false;
    if(!readBoxBounds(in, frame)) return false;
    if(!readAtomData(in, frame)) return false;

    spdlog::debug("Parsed {} atoms at timestep {} ", frame.natoms, frame.timestep);
    
    return true;
}

// Read and validate the LAMMPS dump header.
// Expects an "ITEM: TIMESTEP" line followed by the timestep number,
// then "ITEM: NUMBER OF ATOMS" and the atom count. Reserves spaces in 
// the frame's vectors for positions, types and IDs.
bool LammpsParser::readHeader(std::istream &in, Frame &f) {
    std::string line;
    // Expect "ITEM: TIMESTEP"
    if(!std::getline(in, line) || line.find("ITEM: TIMESTEP") == std::string::npos){
        return false;
    }

    // Next line is the timestep integer
    std::getline(in, line);
    f.timestep = std::stoi(line);
    
    // Skip "ITEM: NUMBER OF ATOMS" and read the atom count
    std::getline(in, line);
    std::getline(in, line);
    
    // Reserve vectors to avoid reallocations
    f.natoms = std::stoi(line);
    f.positions.clear();
    f.types.clear();
    f.ids.clear();
    f.positions.reserve(f.natoms);
    f.types.reserve(f.natoms);
    f.ids.reserve(f.natoms);
    
    return true;
}

// Read the simulation cell bounds including periodicity flags.
// Parses "ITEM: BOX BOUNDS" header token to detect pp/ps flags,
// then reads three lines of lower and upper bounds, optionally with
// tilt for triciclic cells Constructs an AffineTransformation
// for the box matrix and sets PBC flags on the frame.
bool LammpsParser::readBoxBounds(std::istream &in, Frame &f){
    std::string line;
    if(!std::getline(in, line) || line.find("ITEM: BOX BOUNDS") == std::string::npos){
        return false;
    }

    // Tokenize header to extract "pp" flags for each axis
    std::istringstream hdr(line);
    std::vector<std::string> hdrTokens;
    std::string tok;
    while(hdr >> tok){
        hdrTokens.push_back(tok);
    }

    bool pbcX = false, pbcY = false, pbcZ = false;
    if(hdrTokens.size() >= 6){
        // Las three tokens indicate periodicity on x, y, z axes
        pbcX = (hdrTokens[hdrTokens.size()-3] == "pp");
        pbcY = (hdrTokens[hdrTokens.size()-2] == "pp");
        pbcZ = (hdrTokens[hdrTokens.size()-1] == "pp");
    }else{
        pbcX = pbcY = pbcZ = true;
    }

    double lo[3], hi[3], tilt[3] = {0.0, 0.0, 0.0};
    for(int i = 0; i < 3; ++i){
        if (!std::getline(in, line)) return false;
        std::istringstream ss(line);
        if(!(ss >> lo[i] >> hi[i])) return false;
        
        // Try to read tilt factor if present (triclinic box)
        double temp_tilt;
        if(ss >> temp_tilt) {
            tilt[i] = temp_tilt;
        }
        // If no tilt factor, it remains 0.0 (orthogonal box)
    }

    // Adjust min/max for triclinic tilf offsets
    Point3 minc(lo[0], lo[1], lo[2]);
    Point3 maxc(hi[0], hi[1], hi[2]);

    double t0 = tilt[0], t1 = tilt[1];
    double dxmin = std::min({ t0, t1, t0 + t1, 0.0 });
    double dxmax = std::max({ t0, t1, t0 + t1, 0.0 });
    minc.x() -= dxmin;
    maxc.x() -= dxmax;

    double t2 = tilt[2];
    minc.y() -= std::min(t2, 0.0);
    maxc.y() -= std::max(t2, 0.0);

    // Build the cell matrix columns a, b, c and origin shift
    Vector3 a(maxc.x() - minc.x(), 0.0, 0.0);
    Vector3 b(tilt[0], maxc.y() - minc.y(), 0.0);
    Vector3 c(tilt[1], tilt[2], maxc.z() - minc.z());
    Point3 origin = minc;

    AffineTransformation M(a, b, c, origin - Point3::Origin());
    f.simulationCell.setMatrix(M);
    f.simulationCell.setPbcFlags(pbcX, pbcY, pbcZ);

    return true;
}

// Read per-atom data lines into the Frame.
// Expects "ITEM: ATOMS" followed by columns headers (e.g. id, type, x, y, z or xs, ys, zs).
// Determines which columns, refer to ID, type, and positions. Reads each line,
// converts fractional to Cartesian if needed, and stores id/type/position.
bool LammpsParser::readAtomData(std::istream &in, Frame &f){
    std::string line;
    if(!std::getline(in, line) || line.find("ITEM: ATOMS") == std::string::npos){
        return false;
    }

    auto cols = parseColumns(line);
    int idCol = findColumn(cols, "id");
    int typeCol = findColumn(cols, "type");
    int xCol = findColumn(cols, "x");
    int yCol = findColumn(cols, "y");
    int zCol = findColumn(cols, "z");
    int xsCol = findColumn(cols, "xs");
    int ysCol = findColumn(cols, "ys");
    int zsCol = findColumn(cols, "zs");
    bool scaled = (xsCol >= 0 && ysCol >= 0 && zsCol >=0 );

    std::vector<std::string> vals;
    vals.reserve(cols.size());

    for(int i=0; i<f.natoms; ++i){
        if(!std::getline(in, line)){
            return false;
        }

        std::istringstream ss(line);
        vals.clear();
        std::string v;
        
        while(ss >> v){
            vals.push_back(v);
        }

        int id = idCol >= 0 ? std::stoi(vals[idCol]) : (i+1);
        int type = typeCol >= 0 ? std::stoi(vals[typeCol]) : 1;
        double px, py, pz;
        
        if(scaled){
            Point3 frac(std::stod(vals[xsCol]),
                        std::stod(vals[ysCol]),
                        std::stod(vals[zsCol]));
            Point3 cart = f.simulationCell.matrix() * frac;
            px = cart.x(); py = cart.y(); pz = cart.z();
        }else{
            px = std::stod(vals[xCol]);
            py = std::stod(vals[yCol]);
            pz = std::stod(vals[zCol]);
        }

        f.ids.push_back(id);
        f.types.push_back(type);
        f.positions.emplace_back(px, py, pz);
    }
    return true;
}

// Split the "IMTE: ATOMS ..." header into column names.
// Takes the full header line, tokenizes it, and returns only the
// column identifiers that follow "ITEM:" and "ATOMS".
std::vector<std::string> LammpsParser::parseColumns(const std::string &line){
    std::istringstream ss(line);
    std::vector<std::string> cols;
    std::string tok;
    while(ss >> tok) cols.push_back(tok);
    if(cols.size() >= 2 && cols[0] == "ITEM:" && cols[1] == "ATOMS"){
        return std::vector<std::string>(cols.begin()+2, cols.end());
    }
    return {};
}

// Find the index of a given column name in the column list.
// Scans the vector of column names and returns the zero-based index
// if found; returns -1 if the name is not present.
int LammpsParser::findColumn(const std::vector<std::string> &cols, const std::string &name){
    for(size_t i = 0; i < cols.size(); ++i){
        if(cols[i] == name) return (int) i;
    }
    return -1;
}

}
