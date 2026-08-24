// This file must be imported before ANY other imports in the MCP command to ensure
// that stray console.log calls during module initialization do not corrupt the Stdio transport.

export function setupStdioGuard(): void {
  // Redirect console.log, console.warn, console.info, console.debug, and console.trace
  // to stderr to prevent any output corrupting the Stdio JSON-RPC transport.
  // console.error is intentionally left alone — it already goes to stderr.
  const serialize = (arg: unknown): string => {
    if (arg instanceof Error) return arg.stack ?? arg.message;
    if (typeof arg === 'string') return arg;
    return JSON.stringify(arg);
  };

  const redirectToStderr = (...args: unknown[]) => {
    process.stderr.write(args.map(serialize).join(' ') + '\n');
  };
  console.log = redirectToStderr;
  console.warn = redirectToStderr;
  console.info = redirectToStderr;
  console.debug = redirectToStderr;
  console.trace = redirectToStderr;

  // Intercept direct stdout writes from dependencies
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: unknown, ...args: unknown[]) => {
    const str = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
    const trimmed = str.trim();
    if (trimmed.startsWith('{')) {
      return (originalStdoutWrite as (...a: unknown[]) => boolean)(chunk, ...args);
    }
    process.stderr.write(`[stdout-intercepted] ${str}`);
    return true;
  };
}
