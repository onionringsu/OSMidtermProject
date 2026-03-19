const eq1Input = document.getElementById("eq1");
const eq2Input = document.getElementById("eq2");
const solveBtn = document.getElementById("solveBtn");
const clearBtn = document.getElementById("clearBtn");
const stepsEl = document.getElementById("steps");
const detectedTypeEl = document.getElementById("detectedType");
const answersEl = document.getElementById("answers");
const verificationEl = document.getElementById("verification");


solveBtn.addEventListener("click", solveSystem);
clearBtn.addEventListener("click", clearAll);

function clearAll() {
  eq1Input.value = "";
  eq2Input.value = "";
  detectedTypeEl.textContent = "Waiting for input...";
  detectedTypeEl.className = "result-content muted";
  answersEl.textContent = "No solutions yet.";
  answersEl.className = "result-content muted";
  verificationEl.textContent = "No checking yet.";
  verificationEl.className = "result-content muted";
  stepsEl.textContent = "Press Solve to see step-by-step solution.";
  stepsEl.className = "result-content muted";
}

function solveSystem() {
  const raw1 = eq1Input.value.trim();
  const raw2 = eq2Input.value.trim();

  if (!raw1 || !raw2) {
    showError("Please enter both equations.");
    return;
  }

  const special = checkSpecialCases(raw1, raw2);
if (special) {
  answersEl.className = "result-content";
  verificationEl.className = "result-content muted";
  stepsEl.className = "result-content";

  answersEl.innerHTML = `<div class="error">${special}</div>`;
  verificationEl.textContent = "No cheking needed.";
  stepsEl.innerHTML = `<div class="small">${special}</div>`;

  return;
}

  try {
    const eq1 = parseEquation(raw1);
    const eq2 = parseEquation(raw2);

    const type = detectSystemType(raw1, raw2);
    detectedTypeEl.className = "result-content";
    detectedTypeEl.innerHTML = `<strong>${escapeHtml(type)}</strong>`;

    // 🔥 FIRST: try exact solver
    if (type.includes("Quadratic")) {
  const special = solveQuadraticSystem(raw1, raw2);
  if (special.length > 0) {
    renderAnswers(special);
    renderVerification(special, eq1, eq2);
    renderStepsQuadratic(raw1, raw2); // 👈 ADD THIS
    return;
  }
}

    // 🔁 THEN fallback to numeric
    const solutions = findSolutions(eq1.func, eq2.func);

    if (solutions.length === 0) {
  answersEl.className = "result-content";
  verificationEl.className = "result-content";
  stepsEl.className = "result-content";

  answersEl.innerHTML = `<div class="error">No real solutions found.</div>`;
  verificationEl.innerHTML = `<div class="small">Try different inputs.</div>`;
  stepsEl.innerHTML = `<div class="small">No step-by-step solution available for this case.</div>`;

  return;
}

    renderAnswers(solutions);
    renderVerification(solutions, eq1, eq2);
    renderStepsQuadratic(raw1, raw2); // 🔥 ADD THIS

  } catch (err) {
    showError(err.message || "Invalid input.");
  }
  
}

function checkSpecialCases(raw1, raw2) {
  const a = raw1.replace(/\s+/g, "");
  const b = raw2.replace(/\s+/g, "");

  if (a === b) {
    return "Infinite solutions (same equation).";
  }

  const p1 = a.split("=");
  const p2 = b.split("=");

  if (p1.length === 2 && p2.length === 2) {
    if (p1[0] === p2[0] && p1[1] !== p2[1]) {
      return "No solution (contradiction).";
    }
  }

  return null;
}

function solveQuadraticSystem(eq1, eq2) {
  try {
    const clean1 = eq1.replace(/\s+/g, "");
    const clean2 = eq2.replace(/\s+/g, "");

    const match1 = clean1.match(/x\^2([\+\-])y\^2=([\-]?\d*\.?\d+(?:\/\d*\.?\d+)?)/);
    const match2 = clean2.match(/(\d*\.?\d*)\*?x\^2([\+\-])(\d*\.?\d*)\*?y\^2=([\-]?\d*\.?\d+(?:\/\d*\.?\d+)?)/);

    if (!match1 || !match2) return [];

    const sign1 = match1[1] === "+" ? 1 : -1;
    const a = toNumber(match1[2]);

    const A = match2[1] === "" ? 1 : toNumber(match2[1]);
    const sign2 = match2[2] === "+" ? 1 : -1;
    const B = match2[3] === "" ? 1 : toNumber(match2[3]);
    const c = toNumber(match2[4]);

    const y2 = (c - A * a) / (sign2 * B - A * sign1);
    const x2 = a - sign1 * y2;

    if (x2 < 0 || y2 < 0) return [];

    const xs = [Math.sqrt(x2), -Math.sqrt(x2)];
    const ys = [Math.sqrt(y2), -Math.sqrt(y2)];

    const solutions = [];

    for (let x of xs) {
      for (let y of ys) {
        solutions.push({
          x: roundNice(x),
          y: roundNice(y)
        });
      }
    }

    return solutions;
  } catch {
    return [];
  }
}

function showError(message) {
  detectedTypeEl.className = "result-content muted";
  answersEl.className = "result-content";
  verificationEl.className = "result-content muted";

  detectedTypeEl.textContent = "Unable to analyze.";
  answersEl.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
  verificationEl.textContent = "No checking yet.";
}

function parseEquation(input) {
  if (!input.includes("=")) {
    throw new Error("Each equation must contain '='.");
  }

  const parts = input.split("=");
  if (parts.length !== 2) {
    throw new Error("Please use only one '=' in each equation.");
  }

  const left = sanitizeExpression(parts[0]);
  const right = sanitizeExpression(parts[1]);

  const leftFn = makeExpressionFunction(left);
  const rightFn = makeExpressionFunction(right);

  const eqFunc = (x, y) => leftFn(x, y) - rightFn(x, y);

  return {
    raw: input,
    left,
    right,
    leftFn,
    rightFn,
    func: eqFunc
  };
}

function sanitizeExpression(expr) {
  return expr
    .replace(/\s+/g, "")
    .replace(/\^/g, "**")
    .replace(/(\d)([xy])/g, "$1*$2")   // 2x → 2*x
    .replace(/([xy])(\d)/g, "$1*$2");  // x2 → x*2
}

function makeExpressionFunction(expr) {
  try {
    const safeExpr = normalizeFunctions(expr);

    return new Function("x", "y", `
      const sin = Math.sin;
      const cos = Math.cos;
      const tan = Math.tan;
      const sqrt = Math.sqrt;
      const abs = Math.abs;
      const log = Math.log;
      const exp = Math.exp;
      const PI = Math.PI;
      const E = Math.E;

      return (${safeExpr});
    `);
  } catch (e) {
    console.error("Expression error:", expr, e);
    throw new Error("Invalid equation format.");
  }
}


function normalizeFunctions(expr) {
  return expr
    .replace(/\bpi\b/gi, "PI")
    .replace(/\be\b/g, "E");
}

function detectSystemType(eq1, eq2) {
  const combined = (eq1 + " " + eq2).toLowerCase();

  const hasTrig = /sin|cos|tan/.test(combined);
  const hasSqrt = /sqrt/.test(combined);
  const hasPower2 = /\^2/.test(combined);
  const hasPower3OrMore = /\^\d+/.test(combined) && !/\^2(?!\d)/.test(combined);
  const hasMixed = /\bx\b.*\^2|\by\b.*\^2|\^2.*\bx\b|\^2.*\by\b/.test(combined);

  if (hasTrig) return "Trigonometric Nonlinear System";
  if (hasSqrt) return "Radical Nonlinear System";
  if (hasPower3OrMore) return "Higher-Degree Nonlinear System";
  if (hasPower2 && hasMixed) return "Mixed Quadratic Nonlinear System";
  if (hasPower2) return "Quadratic Nonlinear System";

  const isLinearLike = !/[\^]|sin|cos|tan|sqrt|exp|log/.test(combined);
  if (isLinearLike) return "Linear System";

  return "General Nonlinear System";
}

function findSolutions(f1, f2) {
  const guesses = [];
  const vals = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

  for (let a = -5; a <= 5; a += 0.5) {
  for (let b = -5; b <= 5; b += 0.5) {
    guesses.push([a, b]);
  }
}

  const found = [];

  for (const [gx, gy] of guesses) {
    const sol = newtonSolve(f1, f2, gx, gy);
    if (!sol) continue;

    if (!Number.isFinite(sol.x) || !Number.isFinite(sol.y)) continue;
    if (Math.abs(f1(sol.x, sol.y)) > 1e-5) continue;
    if (Math.abs(f2(sol.x, sol.y)) > 1e-5) continue;

    const rounded = {
      x: roundNice(sol.x),
      y: roundNice(sol.y)
    };

    if (!isDuplicate(found, rounded)) {
      found.push(rounded);
    }
  }

  return found.slice(0, 8);
}

function newtonSolve(f1, f2, x0, y0) {
  let x = x0;
  let y = y0;
  const h = 1e-6;

  for (let i = 0; i < 40; i++) {
    let F1, F2;
    try {
      F1 = f1(x, y);
      F2 = f2(x, y);
    } catch {
      return null;
    }

    if (!Number.isFinite(F1) || !Number.isFinite(F2)) return null;

    const dF1dx = (f1(x + h, y) - f1(x - h, y)) / (2 * h);
    const dF1dy = (f1(x, y + h) - f1(x, y - h)) / (2 * h);
    const dF2dx = (f2(x + h, y) - f2(x - h, y)) / (2 * h);
    const dF2dy = (f2(x, y + h) - f2(x, y - h)) / (2 * h);

    const det = dF1dx * dF2dy - dF1dy * dF2dx;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;

    const dx = (-F1 * dF2dy + F2 * dF1dy) / det;
    const dy = (-dF1dx * F2 + dF2dx * F1) / det;

    x += dx;
    y += dy;

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
      return { x, y };
    }
  }

  return { x, y };
}

function isDuplicate(arr, sol) {
  return arr.some(s =>
    Math.abs(s.x - sol.x) < 1e-4 &&
    Math.abs(s.y - sol.y) < 1e-4
  );
}

function toFraction(value, maxDenominator = 100) {
  if (!Number.isFinite(value)) return null;

  if (Math.abs(value - Math.round(value)) < 1e-10) {
    return String(Math.round(value));
  }

  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(value - 1);

  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(value * d);
    const error = Math.abs(value - n / d);

    if (error < bestError) {
      bestError = error;
      bestNumerator = n;
      bestDenominator = d;
    }
  }

  if (bestError > 1e-6) return null;

  const gcdValue = gcd(Math.abs(bestNumerator), Math.abs(bestDenominator));
  bestNumerator /= gcdValue;
  bestDenominator /= gcdValue;

  if (bestDenominator === 1) return String(bestNumerator);
  return `${bestNumerator}/${bestDenominator}`;
}

function gcd(a, b) {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

function toNumber(value) {
  if (value.includes("/")) {
    const [a, b] = value.split("/");
    return Number(a) / Number(b);
  }
  return Number(value);
}

function fmt(n) {
  if (!Number.isFinite(n)) return "undefined";

  const frac = toFraction(n);
  if (frac) return frac;

  if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n));
  return String(Math.round(n * 1000000) / 1000000);
}

function roundNice(n) {
  if (Math.abs(n) < 1e-10) return 0;
  return Math.round(n * 1000000) / 1000000;
}

function renderAnswers(solutions) {
  answersEl.className = "result-content";
  answersEl.innerHTML = solutions.map((sol, i) => `
    <div class="solution-block">
      <div class="solution-title">Solution ${i + 1}</div>
      <div><strong>x</strong> = ${formatNumber(sol.x)}</div>
      <div><strong>y</strong> = ${formatNumber(sol.y)}</div>
    </div>
  `).join("");
}

function renderVerification(solutions, eq1, eq2) {
  verificationEl.className = "result-content";

  verificationEl.innerHTML = solutions.map((sol, i) => {
    const l1 = safeEval(eq1.leftFn, sol.x, sol.y);
    const r1 = safeEval(eq1.rightFn, sol.x, sol.y);
    const l2 = safeEval(eq2.leftFn, sol.x, sol.y);
    const r2 = safeEval(eq2.rightFn, sol.x, sol.y);

    const ok1 = nearlyEqual(l1, r1);
    const ok2 = nearlyEqual(l2, r2);

    return `
      <div class="solution-block">
        <div class="solution-title">Checking ${i + 1}</div>
        <div><strong>x</strong> = ${formatNumber(sol.x)}, <strong>y</strong> = ${formatNumber(sol.y)}</div>
        <div class="small">
          Equation 1: ${formatNumber(l1)} = ${formatNumber(r1)}
          <span class="${ok1 ? "good" : "bad"}">${ok1 ? "✓" : "✗"}</span>
        </div>
        <div class="small">
          Equation 2: ${formatNumber(l2)} = ${formatNumber(r2)}
          <span class="${ok2 ? "good" : "bad"}">${ok2 ? "✓" : "✗"}</span>
        </div>
      </div>
    `;
  }).join("");
}

function safeEval(fn, x, y) {
  try {
    return roundNice(fn(x, y));
  } catch {
    return NaN;
  }
}

function nearlyEqual(a, b, tol = 1e-4) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "undefined";

  const frac = toFraction(n);
  if (frac) return frac;

  if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n));
  return String(roundNice(n));
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStepsQuadratic(eq1, eq2) {
  const clean1 = eq1.replace(/\s+/g, "");
  const clean2 = eq2.replace(/\s+/g, "");

  const match1 = clean1.match(/x\^2([\+\-])y\^2=([\-]?\d*\.?\d+(?:\/\d*\.?\d+)?)/);
  const match2 = clean2.match(/(\d*\.?\d*)\*?x\^2([\+\-])(\d*\.?\d*)\*?y\^2=([\-]?\d*\.?\d+(?:\/\d*\.?\d+)?)/);

  if (!match1 || !match2) {
    stepsEl.innerHTML = `
<div class="small">
This system is solved using numerical methods.<br>
Step-by-step algebraic solution is not available.
</div>
`;
  }

  const sign1 = match1[1] === "+" ? 1 : -1;
  const a = toNumber(match1[2]);

  const A = match2[1] === "" ? 1 : toNumber(match2[1]);
  const sign2 = match2[2] === "+" ? 1 : -1;
  const B = match2[3] === "" ? 1 : toNumber(match2[3]);
  const c = toNumber(match2[4]);

  // Solve for y²
  const y2 = (c - A * a) / (sign2 * B - A * sign1);
  const x2 = a - sign1 * y2;

  if (x2 < 0 || y2 < 0) {
    stepsEl.innerHTML = `<div class="error">No real solutions.</div>`;
    return;
  }

  const x2Str = fmt(x2);
  const y2Str = fmt(y2);

  stepsEl.className = "result-content";

  stepsEl.innerHTML = `
    <div class="solution-block">
      <div class="solution-title">Step 1: Given equations</div>
      <div>${escapeHtml(eq1)}</div>
      <div>${escapeHtml(eq2)}</div>
    </div>

    <div class="solution-block">
      <div class="solution-title">Step 2: Express in terms of x² and y²</div>
      <div>From Equation 1:</div>
      <div><strong>x² ${sign1 === 1 ? "+" : "-"} y² = ${fmt(a)}</strong></div>
    </div>

    <div class="solution-block">
      <div class="solution-title">Step 3: Substitute into Equation 2</div>
      <div>Substitute x² from Equation 1 into Equation 2</div>
    </div>

    <div class="solution-block">
      <div class="solution-title">Step 4: Solve for y²</div>
      <div><strong>y² = ${y2Str}</strong></div>
    </div>

    <div class="solution-block">
      <div class="solution-title">Step 5: Solve for x²</div>
      <div><strong>x² = ${x2Str}</strong></div>
    </div>

    <div class="solution-block">
      <div class="solution-title">Step 6: Take square roots</div>
      <div><strong>x = ±√(${x2Str})</strong></div>
      <div><strong>y = ±√(${y2Str})</strong></div>

      <div class="small" style="margin-top:8px;">
        Possible ordered pairs:
        (√(${x2Str}), √(${y2Str})),
        (√(${x2Str}), -√(${y2Str})),
        (-√(${x2Str}), √(${y2Str})),
        (-√(${x2Str}), -√(${y2Str}))
      </div>
    </div>
  `;
}