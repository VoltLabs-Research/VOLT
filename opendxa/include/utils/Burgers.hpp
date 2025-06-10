#include "../Includes.hpp"

// Helper function to find greatest common divisor
int gcd(int a, int b) {
	a = std::abs(a);
	b = std::abs(b);
	while (b != 0) {
		int temp = b;
		b = a % b;
		a = temp;
	}
	return a;
}
    
// Convert a floating point number to a fraction string
std::string toFraction(double value, double tolerance = 1e-6) {
	if (std::abs(value) < tolerance) {
		return "0";
	}
	
	// Handle negative values
	bool negative = value < 0;
	value = std::abs(value);
	
	// Try common denominators for crystallographic Burgers vectors
	int denominators[] = {1, 2, 3, 4, 6, 12};
	int numDenoms = sizeof(denominators) / sizeof(denominators[0]);
	
	for (int i = 0; i < numDenoms; i++) {
		int denom = denominators[i];
		int numer = static_cast<int>(std::round(value * denom));
		
		if (std::abs(value - static_cast<double>(numer) / denom) < tolerance) {
			// Simplify the fraction
			int g = gcd(numer, denom);
			numer /= g;
			denom /= g;
			
			std::ostringstream oss;
			if (negative) oss << "-";
			
			if (denom == 1) {
				oss << numer;
			} else {
				oss << numer << "/" << denom;
			}
			return oss.str();
		}
	}
	
	// If no simple fraction found, return decimal with limited precision
	std::ostringstream oss;
	if (negative) oss << "-";
	oss << std::fixed << std::setprecision(3) << value;
	return oss.str();
}

std::string burgersToFractionalString(const LatticeVector& bv) {
	std::string xFrac = toFraction(static_cast<double>(bv.X));
	std::string yFrac = toFraction(static_cast<double>(bv.Y));
	std::string zFrac = toFraction(static_cast<double>(bv.Z));
	
	std::ostringstream oss;
	oss << "[" << xFrac << " " << yFrac << " " << zFrac << "]";
	return oss.str();
}