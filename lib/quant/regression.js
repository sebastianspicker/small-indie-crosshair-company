/** Small weighted ridge solver for OLD-pixel surrogate ablations, not learning a new renderer. */
export function features(s, h) { const r = h / 480; return [1, s.size * r, s.thickness * r, s.gap, Number(s.thickness === 0), h / 1080]; }
export function ridgeFit(X, y, weights, lambda = .01) {
    if (!X.length || X.length !== y.length || weights.length !== y.length)
        throw new Error('Invalid regression design.');
    const d = X[0].length, A = Array.from({ length: d }, () => new Array(d + 1).fill(0));
    for (let i = 0; i < X.length; i++) {
        if (X[i].length !== d)
            throw new Error('Nonrectangular design.');
        for (let j = 0; j < d; j++) {
            A[j][d] += weights[i] * X[i][j] * y[i];
            for (let k = 0; k < d; k++)
                A[j][k] += weights[i] * X[i][j] * X[i][k];
        }
    }
    for (let i = 1; i < d; i++)
        A[i][i] += lambda;
    for (let j = 0; j < d; j++) {
        let pivot = j;
        for (let k = j + 1; k < d; k++)
            if (Math.abs(A[k][j]) > Math.abs(A[pivot][j]))
                pivot = k;
        [A[j], A[pivot]] = [A[pivot], A[j]];
        const den = A[j][j];
        if (Math.abs(den) < 1e-12)
            throw new Error('Singular regression design.');
        for (let k = j; k <= d; k++)
            A[j][k] /= den;
        for (let row = 0; row < d; row++)
            if (row !== j) {
                const v = A[row][j];
                for (let k = j; k <= d; k++)
                    A[row][k] -= v * A[j][k];
            }
    }
    return A.map(row => row[d]);
}
export const predictLinear = (beta, x) => beta.reduce((n, b, i) => n + b * x[i], 0);
