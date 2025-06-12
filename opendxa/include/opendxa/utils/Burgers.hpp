#include <opendxa/Includes.hpp>
#include <array>
#include <unordered_map>

static constexpr std::array<int, 6> DENOMINATORS = {1, 2, 3, 4, 6, 12};
static constexpr double TOLERANCE = 1e-16;
static std::unordered_map<uint64_t, std::string> fractionCache;

inline uint64_t hashDouble(double value) noexcept{
	union {
		double d;
		uint64_t i;
	} u;
	u.d = value;
	return u.i;
}

constexpr int gcd(int a, int b) noexcept{
	a = (a < 0) ? -a : a;
	b = (b < 0) ? -b : b;
	while(b){
		a %= b;
		std::swap(a, b);
	}
	return a;
}

std::string toFraction(double value){
	uint64_t hash = hashDouble(value);
	auto it = fractionCache.find(hash);
	if(it != fractionCache.end()){
		return it->second;
	}

	// Special cases
	if(std::abs(value) < TOLERANCE){
		fractionCache[hash] = "0";
		return "0";
	}

	bool negative = value < 0;
	value = std::abs(value);

	for(int denom : DENOMINATORS){
		int numer = static_cast<int>(value * denom + 0.5);
		if(std::abs(value - static_cast<double>(numer) / denom) < TOLERANCE){
			int g = gcd(numer, denom);
			numer /= g;
			denom /= g;
			std::string result;
			result.reserve(16);
			if(negative) result += '-';
			result += std::to_string(numer);
			if(denom != 1){
				result += '/';
				result += std::to_string(denom);
			}
			fractionCache[hash] = result;
			return result;
		}
	}

	// Fallback
	char buffer[16];
    std::sprintf(buffer, "%.3f", negative ? -value : value);
    std::string result(buffer);
    fractionCache[hash] = result;
    return result;
}

std::string burgersToFractionalString(const LatticeVector& bv){
    std::string result;
    result.reserve(32);
    
    result += '[';
    result += toFraction(static_cast<double>(bv.X));
    result += ' ';
    result += toFraction(static_cast<double>(bv.Y));
    result += ' ';
    result += toFraction(static_cast<double>(bv.Z));
    result += ']';
    
    return result;
}
