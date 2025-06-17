#include <opendxa/utils/linalg/lin_alg.hpp>

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


Matrix3::Matrix3(const Quaternion& q){
	DISLOCATIONS_ASSERT_MSG(fabs(q.X*q.X + q.Y*q.Y + q.Z*q.Z + q.W*q.W - 1.0) <= FLOATTYPE_EPSILON, "Matrix3 from Quaternion", "Quaternion must be normalized.");

    FloatType xx = q.X * q.X;
    FloatType xy = q.X * q.Y;
    FloatType xz = q.X * q.Z;
    FloatType xw = q.X * q.W;

    FloatType yy = q.Y * q.Y;
    FloatType yz = q.Y * q.Z;
    FloatType yw = q.Y * q.W;

    FloatType zz = q.Z * q.Z;
    FloatType zw = q.Z * q.W;

    // m[col][row]
    m[0][0] = 1.0 - 2.0 * (yy + zz);
    m[1][0] = 2.0 * (xy - zw);
    m[2][0] = 2.0 * (xz + yw);

    m[0][1] = 2.0 * (xy + zw);
    m[1][1] = 1.0 - 2.0 * (xx + zz);
    m[2][1] = 2.0 * (yz - xw);

    m[0][2] = 2.0 * (xz - yw);
    m[1][2] = 2.0 * (yz + xw);
    m[2][2] = 1.0 - 2.0 * (xx + yy);
}