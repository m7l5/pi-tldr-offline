# @m7l5/pi-tldraw-offline

Control open [tldraw Offline](https://offline.tldraw.com/) canvases from Pi.

## Ownership

This is an independent, unofficial integration and is not affiliated with or endorsed by tldraw.

The MIT license applies only to this extension's original code. tldraw, tldraw Offline, their names and marks, the tldraw application and SDK, and the vendor-provided agent skill belong to tldraw and remain subject to tldraw's own terms. All rights in those materials remain with tldraw and their respective owners.

## Install

Install tldraw Offline separately, then install the extension:

```bash
pi install git:github.com/m7l5/pi-tldr-offline
```

Start tldraw Offline and open or create a document before asking Pi to use it.

## Capabilities

The `tldraw_offline` tool can:

- inspect open documents, shapes, bindings, and screenshots;
- create and edit canvas content;
- lint diagrams;
- manage document-script workspaces and status;
- keep the local bearer token out of model-visible context.

It does not launch tldraw Offline, create the initial document, modify open `.tldraw` archives directly, or bundle the vendor-provided skill.

## Configuration

The extension discovers tldraw Offline's per-launch `server.json` on Linux, macOS, and Windows. Set `TLDRAW_SERVER_JSON` to override its location.

## Security

The tool can execute JavaScript in open canvases and expose durable document scripts. Use it only with trusted agents and documents.

## Development

```bash
npm run check
npm test
npm run pack:check
```
