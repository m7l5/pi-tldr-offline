import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRequest,
  encodeDocumentId,
  formatOutput,
  parseServerConfig,
  resolveServerPath,
} from "../lib.ts";

test("resolves the Linux server path with XDG support", () => {
  assert.equal(
    resolveServerPath({ platform: "linux", home: "/home/alex", env: {} }),
    "/home/alex/.config/tldraw/server.json",
  );
  assert.equal(
    resolveServerPath({
      platform: "linux",
      home: "/home/alex",
      env: { XDG_CONFIG_HOME: "/config" },
    }),
    "/config/tldraw/server.json",
  );
});

test("resolves the macOS server path", () => {
  assert.equal(
    resolveServerPath({ platform: "darwin", home: "/Users/alex", env: {} }),
    "/Users/alex/Library/Application Support/tldraw/server.json",
  );
});

test("resolves the Windows server path with and without APPDATA", () => {
  assert.equal(
    resolveServerPath({
      platform: "win32",
      home: "C:\\Users\\alex",
      env: { APPDATA: "C:\\Users\\alex\\AppData\\Roaming" },
    }),
    "C:\\Users\\alex\\AppData\\Roaming\\tldraw\\server.json",
  );
  assert.equal(
    resolveServerPath({ platform: "win32", home: "C:\\Users\\alex", env: {} }),
    "C:\\Users\\alex\\AppData\\Roaming\\tldraw\\server.json",
  );
});

test("allows an explicit server path override", () => {
  assert.equal(
    resolveServerPath({
      platform: "linux",
      home: "/home/alex",
      env: { TLDRAW_SERVER_JSON: "/run/user/1000/tldraw.json" },
    }),
    "/run/user/1000/tldraw.json",
  );
});

test("parses and validates server configuration", () => {
  assert.deepEqual(parseServerConfig('{"port":7236,"token":"secret"}', "/server.json"), {
    port: 7236,
    token: "secret",
  });
  assert.throws(() => parseServerConfig('{"port":0,"token":"secret"}', "/server.json"));
  assert.throws(() => parseServerConfig('{"port":7236,"token":""}', "/server.json"));
  assert.throws(() => parseServerConfig("not-json", "/server.json"));
});

test("preserves canonical tldraw document ID colons", () => {
  const documentId = "tldr:untitled:M2l5OFd5dVRsNW9qam8yVEFmWEk5";
  assert.equal(encodeDocumentId(documentId), documentId);
  assert.equal(
    buildRequest({ action: "exec", docId: documentId, code: "return true" }).path,
    `/api/doc/${documentId}/exec`,
  );
});

test("supports opaque document IDs", () => {
  assert.equal(
    buildRequest({ action: "script_status", docId: "f7_1WUZim8eqoAKtindZe" }).path,
    "/api/doc/f7_1WUZim8eqoAKtindZe/script-status",
  );
});

test("rejects document IDs containing URL path delimiters", () => {
  for (const documentId of ["a/b", "a?b", "a#b"]) {
    assert.throws(() => encodeDocumentId(documentId), /URL path delimiter/);
  }
});

test("builds the supported API requests", () => {
  assert.deepEqual(buildRequest({ action: "readme" }), {
    method: "GET",
    path: "/readme",
    authenticated: false,
  });
  assert.deepEqual(buildRequest({ action: "search", code: "return await api.getDocs()" }), {
    method: "POST",
    path: "/api/search",
    body: "return await api.getDocs()",
    authenticated: true,
  });
  assert.deepEqual(buildRequest({ action: "script_workspace", docId: "doc-1" }), {
    method: "POST",
    path: "/api/doc/doc-1/script-workspace",
    authenticated: true,
  });
  assert.throws(() => buildRequest({ action: "search" }), /code is required/);
  assert.throws(() => buildRequest({ action: "exec", code: "return true" }), /docId is required/);
});

test("formats JSON output without changing plain text", () => {
  assert.equal(formatOutput('{"ok":true}'), '{\n  "ok": true\n}');
  assert.equal(formatOutput("plain text"), "plain text");
});
