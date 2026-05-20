import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const workspace = mkdtempSync(join(tmpdir(), "3dgraph-consumer-"));

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || workspace,
    stdio: "inherit",
    env: { ...process.env, npm_config_fund: "false", npm_config_audit: "false" },
  });
}

try {
  const packJson = execFileSync("npm", ["pack", "--json", "--pack-destination", workspace], {
    cwd: root,
    encoding: "utf8",
  });
  const [{ filename }] = JSON.parse(packJson);
  const tarball = join(workspace, filename);

  writeFileSync(join(workspace, "package.json"), JSON.stringify({
    type: "module",
    scripts: {
      build: "vite build",
      typecheck: "tsc --noEmit",
      test: "node smoke.test.mjs",
    },
    dependencies: {
      "@a-funk/3d-graph": `file:${tarball}`,
      typescript: "^5.9.3",
      vite: "^7.3.3",
    },
  }, null, 2));

  writeFileSync(join(workspace, "index.html"), [
    "<!doctype html>",
    "<html>",
    "  <head><meta charset=\"utf-8\"><title>3dGraph consumer smoke</title></head>",
    "  <body><div id=\"graph\" style=\"width:100vw;height:100vh\"></div><script type=\"module\" src=\"/main.js\"></script></body>",
    "</html>",
    "",
  ].join("\n"));

  writeFileSync(join(workspace, "main.js"), [
    "import { create3dGraph, generateGraphData, validateGraphData } from '@a-funk/3d-graph';",
    "const data = generateGraphData({ nodeCount: 40, seed: 'consumer-smoke' });",
    "const validation = validateGraphData(data);",
    "if (!validation.valid) throw new Error(validation.errors.join('\\n'));",
    "const graph = create3dGraph({ container: document.getElementById('graph'), data });",
    "globalThis.graph = graph;",
    "",
  ].join("\n"));

  writeFileSync(join(workspace, "smoke.test.mjs"), [
    "import assert from 'node:assert/strict';",
    "import { describeGraph } from '@a-funk/3d-graph/a11y';",
    "import { createGraphModel, generateGraphData, validateGraphData } from '@a-funk/3d-graph';",
    "const data = generateGraphData({ nodeCount: 12, seed: 'pack-smoke' });",
    "assert.equal(validateGraphData(data).valid, true);",
    "const model = createGraphModel(data);",
    "assert.match(describeGraph(model), /12 visible nodes/);",
    "",
  ].join("\n"));

  writeFileSync(join(workspace, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["smoke.ts"],
  }, null, 2));

  writeFileSync(join(workspace, "smoke.ts"), [
    "import type { Create3dGraphOptions, GraphData, TraversalStep } from '@a-funk/3d-graph';",
    "import { createGraphModel, describeGraph, generateGraphData, traversalStep, validateGraphData } from '@a-funk/3d-graph';",
    "import { describeNode } from '@a-funk/3d-graph/a11y';",
    "const data: GraphData = generateGraphData({ nodeCount: 10, seed: 'ts-smoke' });",
    "const validation = validateGraphData(data);",
    "if (!validation.valid) throw new Error(validation.errors.join('\\n'));",
    "const model = createGraphModel(data);",
    "const step: TraversalStep = traversalStep(model.nodes[0]?.id, model);",
    "const summary: string = describeGraph(model);",
    "const detail: string = describeNode(step.candidate?.node, model);",
    "const options: Partial<Create3dGraphOptions> = {",
    "  data,",
    "  onSelect(node) {",
    "    const label: string | null = node?.label ?? null;",
    "    void label;",
    "  },",
    "};",
    "void summary;",
    "void detail;",
    "void options;",
    "",
  ].join("\n"));

  run("npm", ["install"]);
  run("npm", ["test"]);
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "build"]);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
