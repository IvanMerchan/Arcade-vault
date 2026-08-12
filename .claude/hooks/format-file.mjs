#!/usr/bin/env node
// PostToolUse hook (Write|Edit): formats the touched file with Prettier,
// then runs ESLint --fix on it, and reports any remaining lint errors
// as additionalContext. Never blocks — a broken hook must not stop the session.

import { existsSync } from "node:fs";
import path from "node:path";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function output(additionalContext) {
  if (!additionalContext) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
      },
      suppressOutput: true,
    }),
  );
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // no valid payload, nothing to do
  }

  const filePath = input?.tool_response?.filePath ?? input?.tool_input?.file_path;
  if (!filePath || !existsSync(filePath)) return;

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const relative = path.relative(projectDir, filePath);
  const isOutside = relative.startsWith("..") || path.isAbsolute(relative);
  const isExcluded = /(^|[\\/])(node_modules|\.next|out|build)([\\/]|$)/.test(relative);
  if (isOutside || isExcluded) return;

  // Prettier
  try {
    const prettier = await import("prettier");
    const fileInfo = await prettier.getFileInfo(filePath, {
      ignorePath: path.join(projectDir, ".prettierignore"),
    });
    if (!fileInfo.ignored && fileInfo.inferredParser) {
      const options = (await prettier.resolveConfig(filePath)) ?? {};
      const { readFile, writeFile } = await import("node:fs/promises");
      const source = await readFile(filePath, "utf8");
      const formatted = await prettier.format(source, {
        ...options,
        filepath: filePath,
      });
      if (formatted !== source) {
        await writeFile(filePath, formatted, "utf8");
      }
    }
  } catch (err) {
    // Prettier not installed / not applicable — skip silently, but note it.
    process.stderr.write(`format-file hook: prettier step skipped (${err.message})\n`);
  }

  // ESLint --fix (only for JS/TS family files)
  if (/\.(js|jsx|mjs|cjs|ts|tsx)$/.test(filePath)) {
    try {
      const { ESLint } = await import("eslint");
      const eslint = new ESLint({ cwd: projectDir, fix: true });
      const isIgnored = await eslint.isPathIgnored(filePath);
      if (!isIgnored) {
        const results = await eslint.lintFiles([filePath]);
        await ESLint.outputFixes(results);

        const remaining = results.flatMap((r) =>
          r.messages
            .filter((m) => m.severity === 2)
            .map((m) => `${relative}:${m.line}:${m.column} ${m.ruleId ?? ""} — ${m.message}`),
        );
        if (remaining.length > 0) {
          output(`ESLint (no autoarreglable):\n${remaining.join("\n")}`);
        }
      }
    } catch (err) {
      process.stderr.write(`format-file hook: eslint step skipped (${err.message})\n`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`format-file hook failed: ${err?.stack ?? err}\n`);
  process.exit(0);
});
