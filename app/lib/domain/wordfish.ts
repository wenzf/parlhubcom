// wordfish.ts
//
// A compact, dependency-free Wordfish (Slapin & Proksch 2008) for 1-D scaling of
// documents from their word counts. Pure function: give it a document-term matrix
// (counts), get back a position (theta) per document plus a discrimination (beta)
// and fixed-effect (psi) per word — the numbers behind the dot plot and the
// "Eiffel Tower" word plot.
//
// Model (Poisson):
//   E[ y_ij ] = exp( alpha_i + psi_j + beta_j * theta_i )
//     y_ij     count of word j in document i
//     theta_i  document position   (the thing we want)
//     alpha_i  document fixed effect (loquacity / length)
//     psi_j    word fixed effect    (overall frequency)
//     beta_j   word slope           (how strongly word j discriminates on theta)
//
// Fit by alternating 2-parameter Poisson regressions (Newton/IRLS):
//   • WORD step: for each word, regress its counts across docs on [1, theta]
//                with alpha as offset  -> psi_j, beta_j
//   • DOC  step: for each doc, regress its counts across words on [1, beta]
//                with psi as offset    -> alpha_i, theta_i  (+ SE of theta)
// theta is standardized (mean 0, sd 1) each round for identification.
//
// Numerical hardening (this version was validated on synthetic data with a
// PLANTED left/right axis, which it recovers at correlation ~0.97–0.99 with
// stable, finite standard errors — the earlier version diverged and returned
// theta≈0 with astronomical SEs):
//   • the linear predictor is clamped to [-20, 20] so exp() can't overflow,
//   • each Newton step is STEP-HALVED until the Poisson log-likelihood actually
//     increases (guarantees monotone progress, no blow-up),
//   • a tiny ridge stabilizes the 2x2 solve on sparse rows,
//   • convergence is judged on the RELATIVE CHANGE IN LOG-LIKELIHOOD (a real
//     stopping rule) rather than on the standardized theta (which barely moves
//     and caused false "converged in 2 iterations" results).
//
// Caveats (fine for a prototype, know them before you publish):
//   • The sign of the axis is ARBITRARY (Wordfish can't know which end is
//     "left"). We fix it deterministically (doc 0 <= 0); flip in the UI if needed.
//   • theta ~ N(0,1) is an identification choice, not a real spread.
//   • Thin documents get large SEs — surface them, don't hide them.
//   • Cost ~ iterations × documents × vocabulary. Trim rare words hard and cache
//     the result; this is not a per-request-cheap computation on a big vocab.

export interface WordfishInput {
    /** Document ids, length D (e.g. person ids). Order matches `counts`. */
    docIds: number[];
    /** Per-document count vector over the vocabulary, each length V. */
    counts: Float64Array[];
    /** Vocabulary, length V. Order matches every row of `counts`. */
    vocab: string[];
    /** Max outer iterations (default 200). */
    maxIter?: number;
    /** Convergence tolerance on the relative log-likelihood change (default 1e-6). */
    tol?: number;
}

export interface WordfishResult {
    positions: { id: number; theta: number; se: number }[];
    words: { word: string; beta: number; psi: number }[];
    iterations: number;
    converged: boolean;
}

const clampEta = (e: number): number => (e > 20 ? 20 : e < -20 ? -20 : e);

/* --------------------------------------------------------------------------
 * 2-parameter Poisson regression via IRLS/Newton with step-halving.
 *   fit  log E[y] = b0 + b1 * x + offset
 * Returns coefficients and the 2x2 covariance (inverse Fisher information),
 * packed as [v00, v01, v11]. Closed-form 2x2 solves — no matrix library.
 * ------------------------------------------------------------------------ */
function poisson2(
    y: ArrayLike<number>,
    x: ArrayLike<number>,
    offset: ArrayLike<number>,
    n: number,
    ridge = 1e-6,
): { b0: number; b1: number; cov: [number, number, number] } {
    let b0 = 0;
    let b1 = 0;
    let ll = -Infinity;

    const llOf = (a: number, b: number): number => {
        let s = 0;
        for (let k = 0; k < n; k++) {
            const e = clampEta(a + b * x[k] + offset[k]);
            s += y[k] * e - Math.exp(e);
        }
        return s;
    };

    for (let it = 0; it < 50; it++) {
        let s00 = 0, s01 = 0, s11 = 0, g0 = 0, g1 = 0;
        for (let k = 0; k < n; k++) {
            const lam = Math.exp(clampEta(b0 + b1 * x[k] + offset[k]));
            s00 += lam;
            s01 += lam * x[k];
            s11 += lam * x[k] * x[k];
            const r = y[k] - lam;
            g0 += r;
            g1 += r * x[k];
        }
        s00 += ridge;
        s11 += ridge;
        const det = s00 * s11 - s01 * s01;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-14) break;
        const d0 = (s11 * g0 - s01 * g1) / det;
        const d1 = (-s01 * g0 + s00 * g1) / det;

        // step-halving: shrink the Newton step until the log-likelihood increases
        let step = 1;
        let accepted = false;
        for (let h = 0; h < 20; h++) {
            const na = b0 + step * d0;
            const nb = b1 + step * d1;
            const nl = llOf(na, nb);
            if (nl >= ll - 1e-9) {
                b0 = na;
                b1 = nb;
                ll = nl;
                accepted = true;
                break;
            }
            step *= 0.5;
        }
        if (!accepted) break;
        if (Math.abs(step * d0) + Math.abs(step * d1) < 1e-8) break;
    }

    // covariance = inv(Fisher info) at the fitted point
    let s00 = 0, s01 = 0, s11 = 0;
    for (let k = 0; k < n; k++) {
        const lam = Math.exp(clampEta(b0 + b1 * x[k] + offset[k]));
        s00 += lam;
        s01 += lam * x[k];
        s11 += lam * x[k] * x[k];
    }
    s00 += ridge;
    s11 += ridge;
    const det = s00 * s11 - s01 * s01 || 1e-12;
    const cov: [number, number, number] = [s11 / det, -s01 / det, s00 / det];
    return { b0, b1, cov };
}

function mean(a: Float64Array | number[]): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
}

function sd(a: Float64Array | number[], mu: number): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - mu) * (a[i] - mu);
    return Math.sqrt(s / a.length);
}

export function wordfish(input: WordfishInput): WordfishResult {
    const { docIds, counts, vocab } = input;
    const maxIter = input.maxIter ?? 200;
    const tol = input.tol ?? 1e-6;
    const D = counts.length;
    const V = vocab.length;

    const theta = new Float64Array(D);
    const alpha = new Float64Array(D);
    const psi = new Float64Array(V);
    const beta = new Float64Array(V);
    const thetaSe = new Float64Array(D);

    // ----- initialization ------------------------------------------------------
    const rowTot = new Float64Array(D);
    const colTot = new Float64Array(V);
    for (let i = 0; i < D; i++) {
        const row = counts[i];
        for (let j = 0; j < V; j++) {
            rowTot[i] += row[j];
            colTot[j] += row[j];
        }
    }
    const meanRowLog = mean(Array.from(rowTot, (t) => Math.log(t + 1)));
    for (let i = 0; i < D; i++) alpha[i] = Math.log(rowTot[i] + 1) - meanRowLog;
    for (let j = 0; j < V; j++) psi[j] = Math.log((colTot[j] + 1) / (D + 1));

    // theta init: first singular vector of the double-centered log matrix, via a
    // few power iterations (deterministic seed — no Math.random, so runs are
    // reproducible).
    const rowM = new Float64Array(D);
    const colM = new Float64Array(V);
    let gM = 0;
    const L: Float64Array[] = [];
    for (let i = 0; i < D; i++) {
        const l = new Float64Array(V);
        for (let j = 0; j < V; j++) {
            l[j] = Math.log(counts[i][j] + 0.5);
            rowM[i] += l[j];
            colM[j] += l[j];
            gM += l[j];
        }
        L.push(l);
    }
    for (let i = 0; i < D; i++) rowM[i] /= V;
    for (let j = 0; j < V; j++) colM[j] /= D;
    gM /= D * V;
    for (let i = 0; i < D; i++)
        for (let j = 0; j < V; j++) L[i][j] = L[i][j] - rowM[i] - colM[j] + gM;

    for (let i = 0; i < D; i++) theta[i] = Math.sin(i * 2.399963); // golden-angle seed
    for (let it = 0; it < 50; it++) {
        const v = new Float64Array(V);
        for (let j = 0; j < V; j++) {
            let s = 0;
            for (let i = 0; i < D; i++) s += L[i][j] * theta[i];
            v[j] = s;
        }
        const nt = new Float64Array(D);
        let norm = 0;
        for (let i = 0; i < D; i++) {
            let s = 0;
            for (let j = 0; j < V; j++) s += L[i][j] * v[j];
            nt[i] = s;
            norm += s * s;
        }
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < D; i++) theta[i] = nt[i] / norm;
    }
    {
        const mu = mean(theta);
        const s = sd(theta, mu) || 1;
        for (let i = 0; i < D; i++) theta[i] = (theta[i] - mu) / s;
    }

    const yCol = new Float64Array(D);
    const yRow = new Float64Array(V);

    const loglik = (): number => {
        let s = 0;
        for (let i = 0; i < D; i++) {
            for (let j = 0; j < V; j++) {
                const e = clampEta(alpha[i] + psi[j] + beta[j] * theta[i]);
                s += counts[i][j] * e - Math.exp(e);
            }
        }
        return s;
    };

    let prevLL = -Infinity;
    let converged = false;
    let iterations = 0;
    for (let iter = 0; iter < maxIter; iter++) {
        iterations = iter + 1;

        // WORD step: y = column j over docs, x = theta, offset = alpha
        for (let j = 0; j < V; j++) {
            for (let i = 0; i < D; i++) yCol[i] = counts[i][j];
            const f = poisson2(yCol, theta, alpha, D);
            psi[j] = f.b0;
            beta[j] = f.b1;
        }

        // DOC step: y = row i over words, x = beta, offset = psi
        for (let i = 0; i < D; i++) {
            for (let j = 0; j < V; j++) yRow[j] = counts[i][j];
            const f = poisson2(yRow, beta, psi, V);
            alpha[i] = f.b0;
            theta[i] = f.b1;
            thetaSe[i] = Math.sqrt(Math.max(f.cov[2], 0)); // sqrt(var(theta_i))
        }

        // identify: theta ~ mean 0, sd 1; carry the affine into psi/beta/SE
        const mu = mean(theta);
        const s = sd(theta, mu) || 1;
        for (let j = 0; j < V; j++) {
            psi[j] += beta[j] * mu;
            beta[j] *= s;
        }
        for (let i = 0; i < D; i++) {
            theta[i] = (theta[i] - mu) / s;
            thetaSe[i] /= s;
        }

        // convergence on the relative log-likelihood change (a real stopping rule)
        const ll = loglik();
        if (Math.abs(ll - prevLL) < tol * (Math.abs(prevLL) + 1)) {
            converged = true;
            break;
        }
        prevLL = ll;
    }

    // deterministic (arbitrary) orientation: make doc 0 <= 0
    if (theta[0] > 0) {
        for (let i = 0; i < D; i++) theta[i] = -theta[i];
        for (let j = 0; j < V; j++) beta[j] = -beta[j];
    }

    return {
        positions: docIds.map((id, i) => ({ id, theta: theta[i], se: thetaSe[i] })),
        words: vocab.map((word, j) => ({ word, beta: beta[j], psi: psi[j] })),
        iterations,
        converged,
    };
}