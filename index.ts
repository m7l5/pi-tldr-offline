import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  type ExtensionAPI,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  ACTIONS,
  buildRequest,
  DEFAULT_PORT,
  formatOutput,
  parseServerConfig,
  resolveServerPath,
  type ServerConfig,
} from "./lib.ts";

const SKILL_PATH = join(homedir(), "skills", "tldraw-offline", "SKILL.md");

const readServerConfig = async (authenticated: boolean): Promise<ServerConfig> => {
  const serverPath = resolveServerPath();
  try {
    return parseServerConfig(await readFile(serverPath, "utf8"), serverPath);
  } catch (error) {
    if (!authenticated) return { port: DEFAULT_PORT, token: "" };

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `tldraw Offline is not ready. Start the app and open a document, then retry. Expected server configuration at ${serverPath}. ${message}`,
    );
  }
};

const truncateOutput = async (
  output: string,
): Promise<{ text: string; fullOutputPath?: string }> => {
  const truncation = truncateHead(output, {
    maxBytes: DEFAULT_MAX_BYTES,
    maxLines: DEFAULT_MAX_LINES,
  });
  if (!truncation.truncated) return { text: truncation.content };

  const directory = await mkdtemp(join(tmpdir(), "pi-tldraw-"));
  const fullOutputPath = join(directory, "output.txt");
  await withFileMutationQueue(fullOutputPath, () => writeFile(fullOutputPath, output, "utf8"));

  const notice = [
    "",
    `[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
    `(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`,
    `Full output saved to: ${fullOutputPath}]`,
  ].join(" ");

  return { text: `${truncation.content}\n${notice}`, fullOutputPath };
};

export default function tldrawOfflineExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", () =>
    existsSync(SKILL_PATH) ? { skillPaths: [SKILL_PATH] } : {},
  );

  pi.registerTool({
    name: "tldraw_offline",
    label: "tldraw Offline",
    description: [
      "Inspect or modify open tldraw Desktop canvases through its authenticated local API.",
      `Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)}; full output is saved when truncated.`,
    ].join(" "),
    promptSnippet: "Inspect, edit, lint, or script open tldraw Desktop canvases",
    promptGuidelines: [
      "Use tldraw_offline instead of curl or tq for tldraw Desktop HTTP requests.",
      "Use tldraw_offline only with documents already open in tldraw Offline; it does not launch the app or create the initial document.",
      "Never use tldraw_offline or file tools to edit open .tldraw archives, db.sqlite files, metadata.json, lock files, or .script-workspace internals directly.",
    ],
    parameters: Type.Object({
      action: StringEnum(ACTIONS, {
        description:
          "API operation: read documentation, search/query canvases, execute against a document, or manage document scripts.",
      }),
      docId: Type.Optional(
        Type.String({ description: "Document ID required by exec and script actions." }),
      ),
      code: Type.Optional(
        Type.String({ description: "Raw JavaScript required by search and exec actions." }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate) {
      const request = buildRequest(params);
      const server = await readServerConfig(request.authenticated);
      onUpdate?.({
        content: [{ type: "text", text: `Calling tldraw Desktop: ${params.action}…` }],
      });

      const headers: Record<string, string> = {};
      if (request.authenticated) headers.authorization = `Bearer ${server.token}`;
      if (request.body !== undefined) headers["content-type"] = "text/plain";

      let response: Response;
      try {
        response = await fetch(`http://localhost:${server.port}${request.path}`, {
          method: request.method,
          headers,
          body: request.body,
          signal,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `tldraw Offline is not reachable at http://localhost:${server.port}. Start or restart the app and open a document, then retry. ${message}`,
        );
      }

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`tldraw Desktop returned HTTP ${response.status}: ${raw.slice(0, 4096)}`);
      }

      const output = await truncateOutput(formatOutput(raw));
      return {
        content: [{ type: "text", text: output.text }],
        details: {
          action: params.action,
          docId: params.docId,
          status: response.status,
          fullOutputPath: output.fullOutputPath,
        },
      };
    },
  });
}
