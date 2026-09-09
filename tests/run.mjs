// Node에서 실행: node tests/run.mjs
import "./migrate.test.js";
import "./schedule.test.js";
import "./metrics.test.js";
import "./reducers.test.js";
import { runAll } from "./harness.js";

const { passed, failed } = await runAll(({ suite, name, ok, error }) => {
  if (ok) return;
  console.log(`FAIL [${suite}] ${name}\n  ${error.message}`);
});
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
