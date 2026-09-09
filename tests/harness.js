/** 빌드 없이 브라우저(tests/index.html)와 Node(node tests/run.mjs) 양쪽에서 쓰는 최소 테스트 하네스. */
const suites = [];

export function suite(name, fn) {
  const cases = [];
  fn((caseName, run) => cases.push({ name: caseName, run }));
  suites.push({ name, cases });
}

function stringify(value) {
  return JSON.stringify(value, (_k, v) => (v === undefined ? "__undefined__" : v));
}

export function assertEqual(actual, expected, message = "") {
  if (actual !== expected) throw new Error(`${message} expected ${stringify(expected)}, got ${stringify(actual)}`);
}

export function assertDeepEqual(actual, expected, message = "") {
  const a = stringify(actual);
  const b = stringify(expected);
  if (a !== b) throw new Error(`${message}\n  expected ${b}\n  got      ${a}`);
}

export function assertTrue(value, message = "expected truthy") {
  if (!value) throw new Error(message);
}

export function assertThrows(fn, message = "expected to throw") {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

export async function runAll(report) {
  let passed = 0;
  let failed = 0;
  for (const s of suites) {
    for (const c of s.cases) {
      try {
        await c.run();
        passed++;
        report({ suite: s.name, name: c.name, ok: true });
      } catch (error) {
        failed++;
        report({ suite: s.name, name: c.name, ok: false, error });
      }
    }
  }
  return { passed, failed };
}
