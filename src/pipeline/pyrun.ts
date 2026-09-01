import { spawn } from "node:child_process";
import path from "node:path";
import { DIRS } from "./config";

/** Run a python helper script and capture stdout, rejecting on non-zero exit. */
export function runPython(script: string, args: string[], timeoutMs = 300_000): Promise<string> {
  const scriptPath = path.join(DIRS.python, script);
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [scriptPath, ...args], {
      cwd: DIRS.python,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`python ${script} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`python ${script} exited ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}
