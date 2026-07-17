'use strict';

// MCP stdio server — streams a (possibly huge) log file and returns only the
// lines matching a keyword, capped. Avoids Read/Grep loading entire logs
// (some run 100k+ lines) into context. Node built-ins only; no npm deps.

const fs = require('fs');
const readline = require('readline');

const DEFAULT_MAX_LINES = 50;

// ---------------------------------------------------------------------------
// Transport helpers
// ---------------------------------------------------------------------------

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, content) {
  send({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: content }],
    },
  });
}

function sendError(id, code, message) {
  send({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// ReadLog tool implementation
// ---------------------------------------------------------------------------

async function readLog({ filePath, keyword, maxLines }) {
  if (!filePath) {
    return 'Error: "filePath" is required.';
  }
  if (!keyword) {
    return 'Error: "keyword" is required.';
  }
  if (!fs.existsSync(filePath)) {
    return `Error: file not found: ${filePath}`;
  }

  const cap = Number.isFinite(maxLines) && maxLines > 0 ? Math.floor(maxLines) : DEFAULT_MAX_LINES;

  let pattern;
  try {
    pattern = new RegExp(keyword, 'i');
  } catch (err) {
    return `Error: invalid keyword regex: ${err.message}`;
  }

  const matches = [];
  let total = 0;

  await new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    rl.on('line', (line) => {
      if (pattern.test(line)) {
        total += 1;
        matches.push(line);
        if (matches.length > cap) {
          matches.shift();
        }
      }
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });

  const header = `MATCHES: ${total} (showing last ${matches.length})`;
  if (matches.length === 0) {
    return header;
  }
  return `${header}\n${matches.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'ReadLog',
    description:
      'Filter a log file by keyword without loading the whole file into context (some logs run 100k+ lines). Streams the file and returns only matching lines, capped to maxLines (default 50, showing the most recent matches). Only use when the user has provided the log file path AND confirmed the keyword for that specific request — log files only, never source code.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the log file to search' },
        keyword: { type: 'string', description: 'Case-insensitive keyword or regex to match against each line' },
        maxLines: { type: 'number', description: 'Max matching lines to return (default 50, most recent first)' },
      },
      required: ['filePath', 'keyword'],
    },
  },
];

// ---------------------------------------------------------------------------
// Request dispatcher
// ---------------------------------------------------------------------------

function handleRequest(req) {
  const { id, method, params } = req;

  // Notifications (no id) — no response
  if (id === undefined || id === null) {
    return;
  }

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'read-log-server', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    });
    return;
  }

  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOL_DEFINITIONS },
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    if (name !== 'ReadLog') {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    readLog(args || {})
      .then((text) => sendResult(id, text))
      .catch((err) => sendResult(id, `Error: ${err.message}`));
    return;
  }

  sendError(id, -32601, `Method not found: ${method}`);
}

// ---------------------------------------------------------------------------
// Main — read newline-delimited JSON from stdin
// ---------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    handleRequest(req);
  } catch (_) {
    // Malformed JSON — ignore
  }
});
