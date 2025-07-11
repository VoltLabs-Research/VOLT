#include <opendxa/core/lammps_parser.h>
#include <algorithm>
#include <numeric>

namespace OpenDXA{

// Parse a LAMMPS dump file into a Frame structure.
// Opens the given filename for input and hands the resulting stream to parseStream().
// If the file cannot be opened, reports an error and returns false.
bool LammpsParser::parseFile(const std::string &filename, Frame &frame){
    std::ifstream file(filename);
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

    fmt::print("Parsed {} atoms at timestep {} \n", frame.natoms, frame.timestep);
    
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
// converts fractional to Cartesian if needed, an stores id/type/position. Finally,
// sorts atoms by (x, y, z) to ensure deterministic ordering.
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

    for(int i=0; i<f.natoms; ++i){
        if(!std::getline(in, line)){
            return false;
        }

        std::istringstream ss(line);
        std::vector<std::string> vals;
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
    
    // Sort atoms deterministically by position for reproducible results
    // Create index array for sorting
    std::vector<size_t> indices(f.natoms);
    std::iota(indices.begin(), indices.end(), 0);
    
    // Sort indices by position (x, then y, then z)
    std::sort(indices.begin(), indices.end(), [&f](size_t a, size_t b) {
        const auto& posA = f.positions[a];
        const auto& posB = f.positions[b];
        
        const double eps = 1e-12;
        if (std::abs(posA.x() - posB.x()) > eps) return posA.x() < posB.x();
        if (std::abs(posA.y() - posB.y()) > eps) return posA.y() < posB.y();
        return posA.z() < posB.z();
    });
    
    // Reorder all arrays according to sorted indices
    std::vector<int> sortedIds(f.natoms);
    std::vector<int> sortedTypes(f.natoms);
    std::vector<Point3> sortedPositions(f.natoms);
    
    for (size_t i = 0; i < indices.size(); ++i) {
        sortedIds[i] = f.ids[indices[i]];
        sortedTypes[i] = f.types[indices[i]];
        sortedPositions[i] = f.positions[indices[i]];
    }
    
    f.ids = std::move(sortedIds);
    f.types = std::move(sortedTypes);
    f.positions = std::move(sortedPositions);
    
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