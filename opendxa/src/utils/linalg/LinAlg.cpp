#include "utils/linalg/LinAlg.hpp"

NullVector NULL_VECTOR;
IdentityMatrix IDENTITY;
NullMatrix NULL_MATRIX;
Origin ORIGIN;
IdentityScaling IDENTITY_SCALING;

Vector3 unitVectors[3] = {
		Vector3(1,0,0),
		Vector3(0,1,0),
		Vector3(0,0,1)
};

Matrix3 Matrix3::rotation(const Quaternion& q){
	return Matrix3(1.0 - 2.0*(q.Y*q.Y + q.Z*q.Z),       2.0*(q.X*q.Y - q.W*q.Z),       2.0*(q.X*q.Z + q.W*q.Y),
				         2.0*(q.X*q.Y + q.W*q.Z), 1.0 - 2.0*(q.X*q.X + q.Z*q.Z),       2.0*(q.Y*q.Z - q.W*q.X),
			             2.0*(q.X*q.Z - q.W*q.Y),       2.0*(q.Y*q.Z + q.W*q.X), 1.0 - 2.0*(q.X*q.X + q.Y*q.Y));
}

Matrix3 Matrix3::scaling(const Scaling& scaling){
	Matrix3 U = Matrix3::rotation(scaling.Q);
	Matrix3 K = Matrix3(scaling.S.X, 0.0, 0.0,
						0.0, scaling.S.Y, 0.0,
						0.0, 0.0, scaling.S.Z);
	return U * K * U.transposed();
}
