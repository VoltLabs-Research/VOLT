#include <opendxa/core/opendxa.h>
#include <opendxa/math/affine_decomposition.h>
#include <opendxa/math/matrix4.h>

namespace OpenDXA{

void decomp_affine(Matrix4& A, AffineDecomposition* parts);

AffineDecomposition::AffineDecomposition(const AffineTransformation& tm){
	Matrix4 A(tm);
    decomp_affine(A, this);

	if(std::abs(scaling.Q.w()) >= double(1) || scaling.S.equals(Vector3(1,1,1))){
		scaling.Q.setIdentity();
	}
}

enum QuatPart {X, Y, Z, W};

#define mat_pad(A) (A(W,X)=A(X,W)=A(W,Y)=A(Y,W)=A(W,Z)=A(Z,W)=0,A(W,W)=1)
#define mat_copy(C,gets,A,n) { for(size_t i=0; i<n; i++) for(size_t j=0; j<n; j++) C(i,j) gets (A(i,j)); }
#define mat_tpose(AT,gets,A,n) { for(size_t i=0; i<n; i++) for(size_t j=0; j<n; j++) AT(i,j) gets (A(j,i)); }
#define mat_binop(C,gets,A,op,B,n) { for(size_t i=0; i<n; i++) for(size_t j=0; j<n; j++) C(i,j) gets (A(i,j)) op (B(i,j)); }

inline void mat_mult(const Matrix4& A, const Matrix4& B, Matrix4& AB){
    for(size_t i = 0; i < 3; i++){
		for(size_t j = 0; j < 3; j++){
			AB(i, j) = A(i, 0) * B(0, j) + A(i, 1) * B(1, j) + A(i, 2) * B(2, j);
		}
	}
}

inline double vdot(const Vector4& va, const Vector4& vb){
    return (va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]);
}

inline double vdot(const Vector3& va, const Vector4& vb){
    return (va[0]*vb[0] + va[1]*vb[1] + va[2]*vb[2]);
}

inline void vcross(const Vector4& va, const Vector4& vb, Vector4& v){
    v[0] = va[1]*vb[2] - va[2]*vb[1];
    v[1] = va[2]*vb[0] - va[0]*vb[2];
    v[2] = va[0]*vb[1] - va[1]*vb[0];
}

inline void vcross(const Vector4& va, const Vector4& vb, Vector3& v){
    v[0] = va[1]*vb[2] - va[2]*vb[1];
    v[1] = va[2]*vb[0] - va[0]*vb[2];
    v[2] = va[0]*vb[1] - va[1]*vb[0];
}

void adjoint_transpose(Matrix4& M, Matrix4& MadjT){
	Vector4 v = Vector4::Zero();
    vcross(M.row(1), M.row(2), v);
	MadjT.setRow(0, v);
    vcross(M.row(2), M.row(0), v);
	MadjT.setRow(1, v);
    vcross(M.row(0), M.row(1), v);
	MadjT.setRow(2, v);
}


Quaternion Qt_FromMatrix(const Matrix4& mat){
    Quaternion qu;
    double tr, s;

    tr = mat(X,X) + mat(Y,Y)+ mat(Z,Z);
    if(tr >= 0.0){
	    s = sqrt(tr + mat(W,W));
	    qu.w() = s*0.5;
	    s = 0.5 / s;
	    qu.x() = (mat(Z,Y) - mat(Y,Z)) * s;
	    qu.y() = (mat(X,Z) - mat(Z,X)) * s;
	    qu.z() = (mat(Y,X) - mat(X,Y)) * s;
	}else{
	    int h = X;
	    if(mat(Y,Y) > mat(X,X)) h = Y;
	    if(mat(Z,Z) > mat(h,h)) h = Z;
	    switch(h) {

#define caseMacro(i,j,k,I,J,K)  case I:	\
		s = sqrt( (mat(I,I) - (mat(J,J)+mat(K,K))) + mat(W,W) ); \
		qu.i() = s*0.5;	s = 0.5 / s; \
		qu.j() = (mat(I,J) + mat(J,I)) * s; \
		qu.k() = (mat(K,I) + mat(I,K)) * s; \
		qu.w() = (mat(K,J) - mat(J,K)) * s; \
		break

	    caseMacro(x,y,z,X,Y,Z);
	    caseMacro(y,z,x,Y,Z,X);
	    caseMacro(z,x,y,Z,X,Y);
	    }
	}
    if(mat(W,W) != 1.0) qu /= sqrt(mat(W,W));
    return qu;
}

inline double mat_norm(const Matrix4& M, bool tpose){
    double sum, max = 0;
    for(size_t i=0; i<3; i++){
		if(tpose) sum = std::fabs(M(0,i))+std::fabs(M(1,i))+std::fabs(M(2,i));
		else sum = std::fabs(M(i,0))+std::fabs(M(i,1))+std::fabs(M(i,2));
		if(max < sum) max = sum;
    }
    return max;
}

inline double norm_inf(const Matrix4& M) { return mat_norm(M, false); }
inline double norm_one(const Matrix4& M) { return mat_norm(M, true); }

int find_max_col(const Matrix4& M){
    double abs, max = 0;
    int col = -1;
	for(size_t i=0; i<3; i++){
		for(size_t j=0; j<3; j++){
			abs = M(i,j);
			if(abs < 0.0) abs = -abs;
			if(abs > max){
				max = abs; 
				col = j;
			}
		}
    }
    return col;
}

void make_reflector(const Vector3& v, Vector3& u){
    double s = v.length();
    u[0] = v[0]; u[1] = v[1];
    u[2] = v[2] + ((v[2] < 0) ? -s : s);
    s = sqrt(double(2) / u.squaredLength());
    u[0] = u[0]*s; u[1] = u[1]*s; u[2] = u[2]*s;
}

void reflect_cols(Matrix4& M, const Vector3& u){
	for(size_t i=0; i < 3; i++){
		double s = u[0]*M(0,i) + u[1]*M(1,i) + u[2]*M(2,i);
		for(size_t j = 0; j < 3; j++){
			M(j,i) -= u[j]*s;
		}
    }
}

void reflect_rows(Matrix4& M, const Vector3& u){
    for(size_t i=0; i<3; i++){
		double s = vdot(u, M.column(i));
		for(size_t j=0; j<3; j++){
			M(i,j) -= u[j]*s;
		}
    }
}

void do_rank1(Matrix4& M, Matrix4& Q){
	Q = Matrix4::Identity();
    int col = find_max_col(M);
    if(col < 0) return; 
    Vector3 v1{ M(0,col), M(1,col), M(2,col) };
    make_reflector(v1, v1);
    reflect_cols(M, v1);
    Vector3 v2{ M(2,0), M(2,1), M(2,2) };
    make_reflector(v2, v2);
    reflect_rows(M, v2);
    if(M(2,2) < 0.0) Q(2,2) = -1;
    reflect_cols(Q, v1);
    reflect_rows(Q, v2);
}

void do_rank2(Matrix4& M, Matrix4& MadjT, Matrix4& Q){
    double w, x, y, z, c, s, d;
    int col = find_max_col(MadjT);
    if(col<0) {
    	do_rank1(M, Q);
    	return;
    }
    Vector3 v1{ MadjT(0,col), MadjT(1,col), MadjT(2,col) };
    make_reflector(v1, v1);
    reflect_cols(M, v1);
    Vector3 v2;
    vcross(M.row(0), M.row(1), v2);
    make_reflector(v2, v2);
    reflect_rows(M, v2);
    w = M(0,0); x = M(0,1); y = M(1,0); z = M(1,1);
    if (w*z>x*y) {
    	c = z+w; s = y-x; d = sqrt(c*c+s*s); c = c/d; s = s/d;
    	Q(0,0) = Q(1,1) = c; Q(0,1) = -(Q(1,0) = s);
    } else {
    	c = z-w; s = y+x; d = sqrt(c*c+s*s); c = c/d; s = s/d;
    	Q(0,0) = -(Q(1,1) = c); Q(0,1) = Q(1,0) = s;
    }
    Q(0,2) = Q(2,0) = Q(1,2) = Q(2,1) = 0.0; Q(2,2) = 1.0;
    reflect_cols(Q, v1);
    reflect_rows(Q, v2);
}

double polar_decomp(Matrix4& M, Matrix4& Q, Matrix4& S){
    Matrix4 Mk, MadjTk, Ek;
    double det, M_one, M_inf, MadjT_one, MadjT_inf, E_one, gamma, g1, g2;

    mat_tpose(Mk,=,M,3);
    M_one = norm_one(Mk);
    M_inf = norm_inf(Mk);
    do {
		adjoint_transpose(Mk, MadjTk);
		det = vdot(Mk.row(0), MadjTk.row(0));
		if(det==0.0) {
			do_rank2(Mk, MadjTk, Mk); 
			break;
		}
		MadjT_one = norm_one(MadjTk);
		MadjT_inf = norm_inf(MadjTk);
		gamma = sqrt(sqrt((MadjT_one*MadjT_inf)/(M_one*M_inf))/std::fabs(det));
		g1 = gamma*0.5;
		g2 = 0.5/(gamma*det);
		mat_copy(Ek,=,Mk,3);
		mat_binop(Mk,=,g1*Mk,+,g2*MadjTk,3);
		mat_copy(Ek,-=,Mk,3);
		E_one = norm_one(Ek);
		M_one = norm_one(Mk);
		M_inf = norm_inf(Mk);
    }
    while(E_one > M_one * EPSILON);
    mat_tpose(Q,=,Mk,3); 
	mat_pad(Q);
    mat_mult(Mk, M, S);	 
	mat_pad(S);
    for(size_t i=0; i<3; i++)
		for(size_t j=i; j<3; j++)
			S(i,j) = S(j,i) = 0.5*(S(i,j)+S(j,i));
    return det;
}

Vector3 spect_decomp(Matrix4& S, Matrix4& U){
	Vector3 kv;
	double Diag[3],OffD[3]; 
	double g,h,fabsh,fabsOffDi,t,theta,c,s,tau,ta,OffDq,a,b;
	const int nxt[] = {Y,Z,X};
	int sweep, i, j;
	U = Matrix4::Identity();
	Diag[X] = S(X,X); Diag[Y] = S(Y,Y); Diag[Z] = S(Z,Z);
	OffD[X] = S(Y,Z); OffD[Y] = S(Z,X); OffD[Z] = S(X,Y);
	for (sweep=20; sweep>0; sweep--) {
		double sm = std::abs(OffD[X])+std::abs(OffD[Y])+std::abs(OffD[Z]);
		if (sm==0.0) break;
		for (i=Z; i>=X; i--) {
			int p = nxt[i]; int q = nxt[p];
			fabsOffDi = std::abs(OffD[i]);
			g = 100.0*fabsOffDi;
			if (fabsOffDi>0.0) {
				h = Diag[q] - Diag[p];
				fabsh = std::abs(h);
				if (fabsh+g==fabsh) {
					t = OffD[i]/h;
				} else {
					theta = 0.5*h/OffD[i];
					t = 1.0/(std::abs(theta)+sqrt(theta*theta+1.0));
					if (theta<0.0) t = -t;
				}
				c = 1.0/sqrt(t*t+1.0); s = t*c;
				tau = s/(c+1.0);
				ta = t*OffD[i]; OffD[i] = 0.0;
				Diag[p] -= ta; Diag[q] += ta;
				OffDq = OffD[q];
				OffD[q] -= s*(OffD[p] + tau*OffD[q]);
				OffD[p] += s*(OffDq   - tau*OffD[p]);
				for (j=Z; j>=X; j--) {
					a = U(j,p); b = U(j,q);
					U(j,p) -= s*(b + tau*a);
					U(j,q) += s*(a - tau*b);
				}
			}
		}
	}
	return Vector3(Diag[X], Diag[Y], Diag[Z]);
}

Quaternion snuggle(Quaternion q, Vector3& k){
#define SQRTHALF ((double)0.7071067811865475244)
#define sgn(n,v)    ((n)?-(v):(v))
#define swap(a,i,j) {a[3]=a[i]; a[i]=a[j]; a[j]=a[3];}
#define cycle(a,p)  if (p) {a[3]=a[0]; a[0]=a[1]; a[1]=a[2]; a[2]=a[3];} else   {a[3]=a[2]; a[2]=a[1]; a[1]=a[0]; a[0]=a[3];}
    Quaternion p;
    double ka[4];
    int i, turn = -1;
    ka[X] = k.x(); ka[Y] = k.y(); ka[Z] = k.z();
    if (ka[X]==ka[Y]) {if (ka[X]==ka[Z]) turn = W; else turn = Z;}
    else {if (ka[X]==ka[Z]) turn = Y; else if (ka[Y]==ka[Z]) turn = X;}
    if (turn>=0) {
		Quaternion qtoz, qp;
		unsigned neg[3], win;
		double mag[3], t;
		static const Quaternion qxtoz(0,SQRTHALF,0,SQRTHALF);
		static const Quaternion qytoz(SQRTHALF,0,0,SQRTHALF);
		static const Quaternion qppmm( 0.5, 0.5,-0.5,-0.5);
		static const Quaternion qpppp( 0.5, 0.5, 0.5, 0.5);
		static const Quaternion qmpmm(-0.5, 0.5,-0.5,-0.5);
		static const Quaternion qpppm( 0.5, 0.5, 0.5,-0.5);
		static const Quaternion q0001( 0.0, 0.0, 0.0, 1.0);
		static const Quaternion q1000( 1.0, 0.0, 0.0, 0.0);
		switch (turn) {
		default: return q.inverse();
		case X: q = q * (qtoz = qxtoz); swap(ka,X,Z) break;
		case Y: q = q * (qtoz = qytoz); swap(ka,Y,Z) break;
		case Z: qtoz = q0001; break;
		}
		q = q.inverse();
		mag[0] = q.z()*q.z()+q.w()*q.w()-0.5;
		mag[1] = q.x()*q.z()-q.y()*q.w();
		mag[2] = q.y()*q.z()+q.x()*q.w();
		for(i=0; i<3; i++)
			if((neg[i] = (mag[i]<0.0)))
				mag[i] = -mag[i];
		if(mag[0]>mag[1])
			win = (mag[0]>mag[2]) ? 0 : 2;
		else
			win = (mag[1] > mag[2]) ? 1 : 2;
		switch (win) {
		case 0: if (neg[0]) p = q1000; else p = q0001; break;
		case 1: if (neg[1]) p = qppmm; else p = qpppp; cycle(ka,0) break;
		case 2: if (neg[2]) p = qmpmm; else p = qpppm; cycle(ka,1) break;
		}
		qp = q * p;
		t = sqrt(mag[win]+0.5);
		p = p * Quaternion(0.0,0.0,-qp.z()/t,qp.w()/t);
		p = qtoz * p.inverse();
    }
    else {
		double qa[4], pa[4];
		unsigned lo, hi, neg[4], par = 0;
		double all, big, two;
		qa[0] = q.x(); qa[1] = q.y(); qa[2] = q.z(); qa[3] = q.w();
		for (i=0; i<4; i++) {
			pa[i] = 0.0;
			if ((neg[i] = (qa[i]<0.0))) qa[i] = -qa[i];
			par ^= neg[i];
		}
		/* Find two largest components, indices in hi and lo */
		if (qa[0]>qa[1]) lo = 0; else lo = 1;
		if (qa[2]>qa[3]) hi = 2; else hi = 3;
		if (qa[lo]>qa[hi]) {
			if (qa[lo^1]>qa[hi]) {hi = lo; lo ^= 1;}
			else {hi ^= lo; lo ^= hi; hi ^= lo;}
		}
		else { if (qa[hi^1]>qa[lo]) lo = hi^1;}
		all = (qa[0]+qa[1]+qa[2]+qa[3])*0.5;
		two = (qa[hi]+qa[lo])*SQRTHALF;
		big = qa[hi];
		if(all>two) {
			if (all>big) {/*all*/
				{ size_t i; for (i=0; i<4; i++) pa[i] = sgn(neg[i], 0.5); }
				cycle(ka,par)
			}
			else {/*big*/ pa[hi] = sgn(neg[hi],1.0);}
		}
		else {
			if (two>big) {/*two*/
				pa[hi] = sgn(neg[hi],SQRTHALF); pa[lo] = sgn(neg[lo], SQRTHALF);
				if (lo>hi) {hi ^= lo; lo ^= hi; hi ^= lo;}
				if (hi==W) {hi = "\001\002\000"[lo]; lo = 3-hi-lo;}
				swap(ka,hi,lo)
			}
			else {
				/*big*/ pa[hi] = sgn(neg[hi],1.0);
			}
		}
		p.x() = -pa[0]; p.y() = -pa[1]; p.z() = -pa[2]; p.w() = pa[3];
    }
    k.x() = ka[X]; k.y() = ka[Y]; k.z() = ka[Z];
    return p;
}

void decomp_affine(Matrix4& A, AffineDecomposition* parts){
    Matrix4 Q, S, U;
    Quaternion p;
    double det;
    parts->translation = Vector3(A(X,W), A(Y,W), A(Z,W));
    det = polar_decomp(A, Q, S);
    if(det < 0.0) {
		mat_copy(Q,=,-Q,3);
		parts->sign = -1;
    } 
	else parts->sign = 1;
    parts->rotation = Qt_FromMatrix(Q);
	parts->scaling.S = spect_decomp(S, U);
	parts->scaling.Q = Qt_FromMatrix(U);
    p = snuggle(parts->scaling.Q, parts->scaling.S);
    parts->scaling.Q = (parts->scaling.Q * p).normalized();
}

}