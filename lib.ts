import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export const ACTIONS = ["readme", "search", "exec", "script_workspace", "script_status"] as const;
export const DEFAULT_PORT = 7236;

export type Action = (typeof ACTIONS)[number];

export type ServerConfig = {
  port: number;
  token: string;
};

export type Request = {
  method: "GET" | "POST";
  path: string;
  body?: string;
  authenticated: boolean;
};

type ServerPathOptions = {
  platform?: NodeJS.Platform;
  home?: string;
  env?: Record<string, string | undefined>;
};

const requireValue = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is required for this action`);
  return value;
};

export const resolveServerPath = ({
  platform = process.platform,
  home = homedir(),
  env = process.env,
}: ServerPathOptions = {}): string => {
  const override = env.TLDRAW_SERVER_JSON?.trim();
  if (override) return override;

  if (platform === "darwin") {
    return posix.join(home, "Library", "Application Support", "tldraw", "server.json");
  }

  if (platform === "win32") {
    const appData = env.APPDATA?.trim() || win32.join(home, "AppData", "Roaming");
    return win32.join(appData, "tldraw", "server.json");
  }

  return posix.join(
    env.XDG_CONFIG_HOME?.trim() || posix.join(home, ".config"),
    "tldraw",
    "server.json",
  );
};

export const parseServerConfig = (raw: string, serverPath: string): ServerConfig => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in tldraw Offline server configuration at ${serverPath}: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid tldraw Offline server configuration at ${serverPath}`);
  }

  const config = parsed as Partial<ServerConfig>;
  if (!Number.isInteger(config.port) || (config.port ?? 0) < 1 || (config.port ?? 0) > 65535) {
    throw new Error(`Invalid tldraw Offline server port in ${serverPath}`);
  }
  if (typeof config.token !== "string" || !config.token) {
    throw new Error(`Missing tldraw Offline server token in ${serverPath}`);
  }

  return config as ServerConfig;
};

export const encodeDocumentId = (documentId: string): string => {
  if (/[/?#]/.test(documentId)) {
    throw new Error("docId contains a URL path delimiter");
  }

  return encodeURIComponent(documentId).replaceAll("%3A", ":");
};

export const buildRequest = (params: {
  action: Action;
  docId?: string;
  code?: string;
}): Request => {
  if (params.action === "readme") {
    return { method: "GET", path: "/readme", authenticated: false };
  }
  if (params.action === "search") {
    return {
      method: "POST",
      path: "/api/search",
      body: requireValue(params.code, "code"),
      authenticated: true,
    };
  }

  const docId = encodeDocumentId(requireValue(params.docId, "docId"));
  if (params.action === "exec") {
    return {
      method: "POST",
      path: `/api/doc/${docId}/exec`,
      body: requireValue(params.code, "code"),
      authenticated: true,
    };
  }
  if (params.action === "script_workspace") {
    return {
      method: "POST",
      path: `/api/doc/${docId}/script-workspace`,
      authenticated: true,
    };
  }
  return {
    method: "GET",
    path: `/api/doc/${docId}/script-status`,
    authenticated: true,
  };
};

export const formatOutput = (raw: string): string => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};
