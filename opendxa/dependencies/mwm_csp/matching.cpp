/*
MIT License

Copyright (c) 2018 dilsonpereira

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


Modified for use in Minimum-weight matching CSP by PM Larsen.
*/

#include <list>
#include <vector>
#include <cmath>
#include <cassert>
#include <cstdio>

#define EPSILON 1E-12
#define INFINITO 1000000000.0
#define GREATER(A, B) ((A) - (B) > EPSILON)
#define LESS(A, B) ((B) - (A) > EPSILON)
#define EQUAL(A, B) (fabs((A) - (B)) < EPSILON)
#define GREATER_EQUAL(A, B) (GREATER((A),(B)) || EQUAL((A),(B)))
#define LESS_EQUAL(A, B) (LESS((A),(B)) || EQUAL((A),(B)))
#define MIN(A, B) (LESS((A),(B)) ? (A) : (B))
#define MAX(A, B) (LESS((A),(B)) ? (B) : (A))

#define EVEN 2
#define ODD 1
#define UNLABELED 0

#include "mwm_csp.h"

class Matching
{
public:
    //Parametric constructor receives a graph instance
    Matching(int n, int m);

    double Solve(double *costmatrix, int (*res)[2],
            std::vector<int>& free, std::vector<int>& outer, std::vector<int>& tip, std::vector<bool>& active,
            std::vector<int>& type, std::vector<int>& forest, std::vector<int>& root, std::vector<bool>& blocked,
            std::vector<double>& dual, std::vector<double>& slack, std::vector<int>& mate, std::vector<int>& forestList, std::vector<int>& visited);
    int n;
    int m;

private:
    //Grows an alternating forest
    bool Grow(std::vector<int>& free, std::vector<bool>& active, std::vector<bool>& blocked, std::vector<int>& forestList, std::vector<int>& outer, std::vector<int>& type, std::vector<int>& mate, std::vector<int>& forest, std::vector<int>& root,
            std::vector<int>& visited, std::vector<double>& slack, std::vector<double>& dual,std::vector<int>& tip);

    //Expands a blossom u
    //If expandBlocked is true, the blossom will be expanded even if it is blocked
    void Expand(int u, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& slack, std::vector<int>& outer, std::vector<bool>& active, std::vector<int>& mate, bool expandBlocked);

    //Augments the matching using the path from u to v in the alternating forest
    void Augment(int u, int v, std::vector<int>& outer, std::vector<int>& forest, std::vector<int>& mate, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& slack, std::vector<bool>& active);

    //Resets the alternating forest
    void Reset( std::vector<int>& free,
            std::vector<int>& outer,
            std::vector<bool>& active,
            std::vector<int>& type,
            std::vector<int>& forest,
            std::vector<int>& root,
            std::vector<bool>& blocked,
            std::vector<double>& dual,
            std::vector<int>& mate,
            std::vector<int>& forestList,
            std::vector<int>& visited);

    //Creates a blossom where the tip is the first common vertex in the paths from u and v in the hungarian forest
    int Blossom(int u, int v,
                std::vector<int>& free,
                std::vector<int>& outer,
                std::vector<int>& tip,
                std::vector<bool>& active,
                std::vector<int>& type,
                std::vector<int>& forest,
                std::vector<int>& root,
                std::vector<int>& mate);

    void UpdateDualCosts(   std::vector<int>& free,
                std::vector<int>& outer,
                std::vector<bool>& active,
                std::vector<int>& type,
                std::vector<bool>& blocked,
                std::vector<double>& dual,
                std::vector<double>& slack,
                std::vector<int>& mate);

    //Resets all data structures 
    void Clear();

    void DestroyBlossom(int t, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& dual, std::vector<bool>& active, std::vector<int>& mate, std::vector<int>& outer);

    void ClearBlossomIndices();

    std::vector< std::vector<int> > deep;//deep[v] is a list of all the original vertices contained inside v, deep[v] = v if v is an original vertex
    std::vector< std::list<int> > shallow;//shallow[v] is a list of the vertices immediately contained inside v, shallow[v] is empty is the default
};


static int GetEdgeIndex(int n, int u, int v)
{
    if (u > v) std::swap(u, v);
    return u * n - (u + 1) * (u + 2) / 2 + v;
}

//An edge might be blocked due to the dual costs
static bool IsEdgeBlocked(std::vector<double>& slack, int n, int u, int v)
{
    return GREATER(slack[ GetEdgeIndex(n, u, v) ], 0);
}

//Returns true if u and v are adjacent in G and not blocked
static bool IsAdjacent(std::vector<double>& slack, int n, int u, int v)
{
    return (u != v && ! IsEdgeBlocked(slack, n, u, v));
}

static void AddFreeBlossomIndex(std::vector<int>& free, int i)
{
    free.push_back(i);
}

static int GetFreeBlossomIndex(std::vector<int>& free)
{
    int i = free.back();
    free.pop_back();
    return i;
}

Matching::Matching(int n, int m):
    n(n),
    m(m),
    deep(2*n),
    shallow(2*n)
{}

bool Matching::Grow(std::vector<int>& free, std::vector<bool>& active, std::vector<bool>& blocked, std::vector<int>& forestList, std::vector<int>& outer, std::vector<int>& type, std::vector<int>& mate, std::vector<int>& forest, std::vector<int>& root,
            std::vector<int>& visited, std::vector<double>& slack, std::vector<double>& dual, std::vector<int>& tip)
{
    Reset(free, outer, active, type, forest, root, blocked, dual, mate, forestList, visited);

    //All unmatched vertices will be roots in a forest that will be grown
    //The forest is grown by extending a unmatched vertex w through a matched edge u-v in a BFS fashion
    while(!forestList.empty())
    {
        int w = outer[forestList.back()];
        forestList.pop_back();

        //w might be a blossom
        //we have to explore all the connections from vertices inside the blossom to other vertices
        for(std::vector<int>::iterator it = deep[w].begin(); it != deep[w].end(); it++)
        {
            int u = *it;

            int cont = false;
            for (int v=0;v<n;v++)
            {
                if (u == v) continue;
                if(IsEdgeBlocked(slack, n, u, v)) continue;

                //u is even and v is odd
                if(type[outer[v]] == ODD) continue; 

                //if v is unlabeled
                if(type[outer[v]] != EVEN)
                {
                    //We grow the alternating forest
                    int vm = mate[outer[v]];

                    forest[outer[v]] = u;
                    type[outer[v]] = ODD;
                    root[outer[v]] = root[outer[u]];
                    forest[outer[vm]] = v;
                    type[outer[vm]] = EVEN;
                    root[outer[vm]] = root[outer[u]];

                    if(!visited[outer[vm]])
                    {
                        forestList.push_back(vm);
                        visited[outer[vm]] = true;
                    }
                }
                //If v is even and u and v are on different trees
                //we found an augmenting path
                else if(root[outer[v]] != root[outer[u]])
                {
                    Augment(u,v, outer, forest, mate, free, blocked, slack, active);
                    Reset(free, outer, active, type, forest, root, blocked, dual, mate, forestList, visited);

                    cont = true;
                    break;
                }
                //If u and v are even and on the same tree
                //we found a blossom
                else if(outer[u] != outer[v])
                {
                    int b = Blossom(u, v, free,outer,tip,active,type,forest,root,mate);

                    forestList.push_back(b);
                    visited[b] = true;

                    cont = true;
                    break;
                } 
            }
            if(cont) break;
        }
    }

    //Check whether the matching is perfect
    for(int i = 0; i < n; i++)
        if(mate[outer[i]] == -1)
            return false;
    return true;
}

//Vertices will be selected in non-decreasing order of their degree
//Each time an unmatched vertex is selected, it is matched to its adjacent unmatched vertex of minimum degree
static void Heuristic(int n, std::vector< double >& slack, std::vector<int>& mate, std::vector<int>& outer)
{
    std::vector<int> degree(n, 0);

    for (int u=0;u<n;u++)
    {
        for (int v=u+1;v<n;v++)
        {
            if(IsEdgeBlocked(slack, n, u, v)) continue;

            degree[u]++;
            degree[v]++;
        }
    }

    for (int u = 0;u < n; u++)
    {
        if(mate[outer[u]] == -1)
        {
            int min = -1;
            for (int v=0;v<n;v++)
            {
                if (u == v) continue;

                if(IsEdgeBlocked(slack, n, u, v) ||
                    (outer[u] == outer[v]) ||
                    (mate[outer[v]] != -1) )
                    continue;

                if(min == -1 || degree[v] < degree[min])
                    min = v;    
            }
            if(min != -1)
            {
                mate[outer[u]] = min;
                mate[outer[min]] = u;
            }
        }
    }
}

//Destroys a blossom recursively
void Matching::DestroyBlossom(int t, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& dual, std::vector<bool>& active, std::vector<int>& mate, std::vector<int>& outer)
{
    if((t < n) || (blocked[t] && GREATER(dual[t], 0)))
        return;

    for(std::list<int>::iterator it = shallow[t].begin(); it != shallow[t].end(); it++)
    {
        int s = *it;
        outer[s] = s;
        for(std::vector<int>::iterator jt = deep[s].begin(); jt != deep[s].end(); jt++)
            outer[*jt] = s; 

        DestroyBlossom(s, free, blocked, dual, active, mate, outer);
    }

    active[t] = false;
    blocked[t] = false;
    AddFreeBlossomIndex(free, t);
    mate[t] = -1;
}

void Matching::Expand(int u, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& slack, std::vector<int>& outer, std::vector<bool>& active, std::vector<int>& mate, bool expandBlocked = false)
{
    int v = outer[mate[u]];

    int index = m;
    int p = -1, q = -1;
    //Find the regular edge {p,q} of minimum index connecting u and its mate
    //We use the minimum index to grant that the two possible blossoms u and v will use the same edge for a mate
    for(std::vector<int>::iterator it = deep[u].begin(); it != deep[u].end(); it++)
    {   
        int di = *it;
        for(std::vector<int>::iterator jt = deep[v].begin(); jt != deep[v].end(); jt++)
        {
            int dj = *jt;
            if(IsAdjacent(slack, n, di, dj) && GetEdgeIndex(n, di, dj) < index)
            {
                index = GetEdgeIndex(n, di, dj);
                p = di;
                q = dj;
            }
        }
    }
    
    mate[u] = q;
    mate[v] = p;
    //If u is a regular vertex, we are done
    if(u < n || (blocked[u] && ! expandBlocked)) return;

    bool found = false;
    //Find the position t of the new tip of the blossom
    for(std::list<int>::iterator it = shallow[u].begin(); it != shallow[u].end() && ! found; )
    {
        int si = *it;
        for(std::vector<int>::iterator jt = deep[si].begin(); jt != deep[si].end() && ! found; jt++)
        {
            if(*jt == p )
                found = true;
        }
        it++;
        if(! found)
        {
            shallow[u].push_back(si);
            shallow[u].pop_front();
        }
    }
    
    std::list<int>::iterator it = shallow[u].begin();
    //Adjust the mate of the tip
    mate[*it] = mate[u];
    it++;
    //
    //Now we go through the odd circuit adjusting the new mates
    while(it != shallow[u].end())
    {
        std::list<int>::iterator itnext = it;
        itnext++;
        mate[*it] = *itnext;
        mate[*itnext] = *it;
        itnext++;
        it = itnext;
    }

    //We update the sets blossom, shallow, and outer since this blossom is being deactivated
    for(std::list<int>::iterator it = shallow[u].begin(); it != shallow[u].end(); it++)
    {
        int s = *it;
        outer[s] = s;
        for(std::vector<int>::iterator jt = deep[s].begin(); jt != deep[s].end(); jt++)
            outer[*jt] = s; 
    }
    active[u] = false;
    AddFreeBlossomIndex(free, u);
    
    //Expand the vertices in the blossom
    for(std::list<int>::iterator it = shallow[u].begin(); it != shallow[u].end(); it++)
        Expand(*it, free, blocked, slack, outer, active, mate, expandBlocked);

}

//Augment the path root[u], ..., u, v, ..., root[v]
void Matching::Augment(int u, int v, std::vector<int>& outer, std::vector<int>& forest, std::vector<int>& mate, std::vector<int>& free, std::vector<bool>& blocked, std::vector<double>& slack, std::vector<bool>& active)
{
    //We go from u and v to its respective roots, alternating the matching
    int p = outer[u];
    int q = outer[v];
    int outv = q;
    int fp = forest[p];
    mate[p] = q;
    mate[q] = p;
    Expand(p, free, blocked, slack, outer, active, mate);
    Expand(q, free, blocked, slack, outer, active, mate);
    while(fp != -1)
    {
        q = outer[forest[p]];
        p = outer[forest[q]];
        fp = forest[p];

        mate[p] = q;
        mate[q] = p;
        Expand(p, free, blocked, slack, outer, active, mate);
        Expand(q, free, blocked, slack, outer, active, mate);
    }

    p = outv;
    fp = forest[p];
    while(fp != -1)
    {
        q = outer[forest[p]];
        p = outer[forest[q]];
        fp = forest[p];

        mate[p] = q;
        mate[q] = p;
        Expand(p, free, blocked, slack, outer, active, mate);
        Expand(q, free, blocked, slack, outer, active, mate);
    }
}

void Matching::Reset(   std::vector<int>& free,
            std::vector<int>& outer,
            std::vector<bool>& active,
            std::vector<int>& type,
            std::vector<int>& forest,
            std::vector<int>& root,
            std::vector<bool>& blocked,
            std::vector<double>& dual,
            std::vector<int>& mate,
            std::vector<int>& forestList,
            std::vector<int>& visited)
{
    for(int i = 0; i < 2*n; i++)
    {
        forest[i] = -1;
        root[i] = i;

        if(i >= n && active[i] && outer[i] == i)
            DestroyBlossom(i, free, blocked, dual, active, mate, outer);
    }

    visited.assign(2*n, 0);
    forestList.clear();
    for(int i = 0; i < n; i++)
    {
        if(mate[outer[i]] == -1)
        {
            type[outer[i]] = 2;
            if(!visited[outer[i]])
                forestList.push_back(i);
            visited[outer[i]] = true;
        }
        else type[outer[i]] = 0;
    }
}

//Contracts the blossom w, ..., u, v, ..., w, where w is the first vertex that appears in the paths from u and v to their respective roots
int Matching::Blossom(int u, int v,
                std::vector<int>& free,
                std::vector<int>& outer,
                std::vector<int>& tip,
                std::vector<bool>& active,
                std::vector<int>& type,
                std::vector<int>& forest,
                std::vector<int>& root,
                std::vector<int>& mate)
{
    int t = GetFreeBlossomIndex(free);

    std::vector<bool> isInPath(2*n, false);

    //Find the tip of the blossom
    int u_ = u; 
    while(u_ != -1)
    {
        isInPath[outer[u_]] = true;

        u_ = forest[outer[u_]];
    }

    int v_ = outer[v];
    while(! isInPath[v_])
        v_ = outer[forest[v_]];
    tip[t] = v_;

    //Find the odd circuit, update shallow, outer, blossom and deep
    //First we construct the set shallow (the odd circuit)
    std::list<int> circuit;
    u_ = outer[u];
    circuit.push_front(u_);
    while(u_ != tip[t])
    {
        u_ = outer[forest[u_]];
        circuit.push_front(u_);
    }

    shallow[t].clear();
    deep[t].clear();
    for(std::list<int>::iterator it = circuit.begin(); it != circuit.end(); it++)
    {
        shallow[t].push_back(*it);
    }

    v_ = outer[v];
    while(v_ != tip[t])
    {
        shallow[t].push_back(v_);
        v_ = outer[forest[v_]];
    }

    //Now we construct deep and update outer
    for(std::list<int>::iterator it = shallow[t].begin(); it != shallow[t].end(); it++)
    {
        u_ = *it;
        outer[u_] = t;
        for(std::vector<int>::iterator jt = deep[u_].begin(); jt != deep[u_].end(); jt++)
        {
            deep[t].push_back(*jt);
            outer[*jt] = t;
        }
    }

    forest[t] = forest[tip[t]];
    type[t] = EVEN;
    root[t] = root[tip[t]];
    active[t] = true;
    outer[t] = t;
    mate[t] = mate[tip[t]];

    return t;
}

void Matching::UpdateDualCosts( std::vector<int>& free,
                std::vector<int>& outer,
                std::vector<bool>& active,
                std::vector<int>& type,
                std::vector<bool>& blocked,
                std::vector<double>& dual,
                std::vector<double>& slack,
                std::vector<int>& mate)
{
    double e1 = 0, e2 = 0, e3 = 0;
    int inite1 = false, inite2 = false, inite3 = false;

    for (int u=0;u<n;u++)
    {
        for (int v=u+1;v<n;v++)
        {
            int i = GetEdgeIndex(n, u, v);

            if( (type[outer[u]] == EVEN && type[outer[v]] == UNLABELED) || (type[outer[v]] == EVEN && type[outer[u]] == UNLABELED) )
            {
                if(!inite1 || GREATER(e1, slack[i]))
                {
                    e1 = slack[i];
                    inite1 = true;
                }
            }
            else if( (outer[u] != outer[v]) && type[outer[u]] == EVEN && type[outer[v]] == EVEN )
            {
                if(!inite2 || GREATER(e2, slack[i]))
                {
                    e2 = slack[i];
                    inite2 = true;
                }
            }
        }
    }

    for(int i = n; i < 2*n; i++)
    {
        if(active[i] && i == outer[i] && type[outer[i]] == ODD && (!inite3 || GREATER(e3, dual[i])))
        {
            e3 = dual[i]; 
            inite3 = true;
        }   
    }
    double e = 0;
    if(inite1) e = e1;
    else if(inite2) e = e2;
    else if(inite3) e = e3;

    if(GREATER(e, e2/2.0) && inite2)
        e = e2/2.0;
    if(GREATER(e, e3) && inite3)
        e = e3;
     
    for(int i = 0; i < 2*n; i++)
    {
        if(i != outer[i]) continue;

        if(active[i] && type[outer[i]] == EVEN) 
        {
            dual[i] += e; 
        }
        else if(active[i] && type[outer[i]] == ODD)
        {
            dual[i] -= e; 
        }
    }

    for (int u=0;u<n;u++)
    {
        for (int v=u+1;v<n;v++)
        {
            int i = GetEdgeIndex(n, u, v);

            if (outer[u] != outer[v])
            {   
                if(type[outer[u]] == EVEN && type[outer[v]] == EVEN)
                    slack[i] -= 2.0*e;
                else if(type[outer[u]] == ODD && type[outer[v]] == ODD)
                    slack[i] += 2.0*e;
                else if( (type[outer[v]] == UNLABELED && type[outer[u]] == EVEN) || (type[outer[u]] == UNLABELED && type[outer[v]] == EVEN) )
                    slack[i] -= e;
                else if( (type[outer[v]] == UNLABELED && type[outer[u]] == ODD) || (type[outer[u]] == UNLABELED && type[outer[v]] == ODD) )
                    slack[i] += e;
            }
        }
    }

    for(int i = n; i < 2*n; i++)
    {
        if(GREATER(dual[i], 0))
        {
            blocked[i] = true;
        }
        else if(active[i] && blocked[i])
        {
            //The blossom is becoming unblocked
            if(mate[i] == -1)
            {
                DestroyBlossom(i, free, blocked, dual, active, mate, outer);
            }
            else
            {
                blocked[i] = false;
                Expand(i, free, blocked, slack, outer, active, mate);
            }
        }
    }   
}

double Matching::Solve(double *costmatrix, int (*res)[2],
            std::vector<int>& free, std::vector<int>& outer, std::vector<int>& tip, std::vector<bool>& active,
            std::vector<int>& type, std::vector<int>& forest, std::vector<int>& root, std::vector<bool>& blocked,
            std::vector<double>& dual, std::vector<double>& slack, std::vector<int>& mate, std::vector<int>& forestList, std::vector<int>& visited)
{
    free.clear();
    for(int i = n; i < 2*n; i++)
        AddFreeBlossomIndex(free, i);

    for(int i = 0; i < 2*n; i++)
    {
        outer[i] = i;
        deep[i].clear();
        if (i < n)
            deep[i].push_back(i);

        shallow[i].clear();
        if(i < n)
            active[i] = true;
        else
            active[i] = false;
    
        type[i] = 0;
        forest[i] = -1;
        root[i] = i;

        blocked[i] = false;
        dual[i] = 0;
        mate[i] = -1;
        tip[i] = i;
    }

    //-------- modify the costs of the graph so the all edges have positive costs --------
    double minEdge = 0;
    for(int i = 0; i < m ;i++)
        if(GREATER(minEdge - slack[i], 0)) 
            minEdge = slack[i];

    for(int i = 0; i < m; i++)
        slack[i] -= minEdge;

    //If the matching on the compressed graph is perfect, we are done
    bool perfect = false;
    while(! perfect)
    {
        //Run an heuristic maximum matching algorithm
        Heuristic(n, slack, mate, outer);

        //Grow a hungarian forest
        perfect = Grow(free, active, blocked, forestList, outer, type, mate, forest, root, visited, slack, dual, tip);
        UpdateDualCosts(free, outer, active, type, blocked, dual, slack, mate);

        //Set up the algorithm for a new grow step
        Reset(free, outer, active, type, forest, root, blocked, dual, mate, forestList, visited);
    }

    //-------- retrieve matching --------
    for(int i = 0; i < 2*n; i++)
        if(active[i] && mate[i] != -1 && outer[i] == i)
            Expand(i, free, blocked, slack, outer, active, mate, true);

    int z = 0;
    double obj = 0;
    bool hit[MWM_CSP_MAX_POINTS] = {0};
    for(int u = 0; u < n; u++)
    {
        if (hit[u])
            continue;

        int v = mate[u];
        hit[u] = true;
        hit[v] = true;

        obj += costmatrix[u * n + v];
        res[z][0] = u;
        res[z][1] = v;
        z++;
    }

    return obj; 
}

double _MinimumCostPerfectMatching(int n, double *costmatrix, int (*res)[2])
{
    std::vector<double> slack;//slack associated to each edge, if slack[e] > 0, the edge cannot be used

    for (int i=0;i<n;i++)
        for (int j=i+1;j<n;j++)
            slack.push_back(costmatrix[i * n + j]);

    int m = n * (n - 1) / 2;
    Matching M(n, m);


    std::vector<int> forestList(n);
    std::vector<int> free;//List of free blossom indices

    std::vector<int> outer(2*n);//outer[v] gives the index of the outermost blossom that contains v, outer[v] = v if v is not contained in any blossom
    std::vector<int> tip(2*n);//tip[v] is the tip of blossom v
    std::vector<bool> active(2*n);//true if a blossom is being used

    std::vector<int> type(2*n);//Even, odd, neither (2, 1, 0)
    std::vector<int> forest(2*n);//forest[v] gives the father of v in the alternating forest
    std::vector<int> root(2*n);//root[v] gives the root of v in the alternating forest 

    std::vector<bool> blocked(2*n);//A blossom can be blocked due to dual costs, this means that it behaves as if it were an original vertex and cannot be expanded
    std::vector<double> dual(2*n);//dual multipliers associated to the blossoms, if dual[v] > 0, the blossom is blocked and full
    std::vector<int> mate(2*n);//mate[v] gives the mate of v
    std::vector<int> visited(2*n);

    return M.Solve(costmatrix, res, free, outer, tip, active, type, forest, root, blocked, dual, slack, mate, forestList, visited);
}

#ifdef __cplusplus
extern "C" {
#endif

double MinimumCostPerfectMatching(int n, double *costmatrix, int (*res)[2]) {
    return _MinimumCostPerfectMatching(n, costmatrix, res);
}

#ifdef __cplusplus
}
#endif

