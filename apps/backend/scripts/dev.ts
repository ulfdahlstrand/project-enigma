import { spawn, type ChildProcess } from "node:child_process";

const childProcesses = new Set<ChildProcess>();

function spawnProcess(args: string[]) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });

  childProcesses.add(child);
  child.on("exit", () => {
    childProcesses.delete(child);
  });

  return child;
}

function terminateChildren(signal: NodeJS.Signals) {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

async function main() {
  const backend = spawnProcess([
    "--watch",
    "--env-file=.env",
    "--import",
    "tsx/esm",
    "src/index.ts",
  ]);

  const handleSignal = (signal: NodeJS.Signals) => {
    terminateChildren(signal);
    process.exit(0);
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  const exitCode = await new Promise<number>((resolve) => {
    backend.on("exit", (code) => resolve(code ?? 0));
  });

  terminateChildren("SIGTERM");
  process.exit(exitCode);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  terminateChildren("SIGTERM");
  process.exit(1);
});
