'use strict';

// MCP stdio server — creates a GitHub release via the `gh` CLI. GitHub
// creates the git tag automatically (pointing at the target branch's HEAD)
// if it doesn't already exist. Node built-ins only; no npm deps.

const { execFileSync } = require('child_process');
const readline = require('readline');

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
// GitHubRelease tool implementation
// ---------------------------------------------------------------------------

function createRelease({ tag, targetBranch, notes, title, prerelease, repoPath }) {
  if (!tag) {
    return 'Error: "tag" is required.';
  }
  if (!targetBranch) {
    return 'Error: "targetBranch" is required.';
  }
  if (!notes) {
    return 'Error: "notes" is required.';
  }

  const isPrerelease = typeof prerelease === 'boolean' ? prerelease : /-rc\d*$/i.test(tag);
  const releaseTitle = title || tag;

  const args = [
    'release',
    'create',
    tag,
    '--target',
    targetBranch,
    '--title',
    releaseTitle,
    '--notes',
    notes,
  ];
  if (isPrerelease) {
    args.push('--prerelease');
  }

  try {
    const stdout = execFileSync('gh', args, {
      encoding: 'utf8',
      cwd: repoPath || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return `Release created (${isPrerelease ? 'prerelease' : 'release'}): ${stdout.trim()}`;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    return `Error: gh release create failed.\n${stderr || stdout || err.message}`;
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'GitHubRelease',
    description:
      'Create a GitHub release using the gh CLI (must already be authenticated via `gh auth login`). GitHub creates the git tag automatically, pointing at the target branch\'s current HEAD, if the tag does not already exist. Prerelease is auto-detected from the tag (matches -rcN suffix) unless explicitly overridden.',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Release/tag name, e.g. "1.1.7" or "1.1.7-rc07"' },
        targetBranch: { type: 'string', description: 'Branch the tag should point at, e.g. "master" or "dev"' },
        notes: { type: 'string', description: 'Release notes body (e.g. the changelog entry text)' },
        title: { type: 'string', description: 'Release title (defaults to the tag if omitted)' },
        prerelease: {
          type: 'boolean',
          description: 'Force prerelease flag on/off. If omitted, auto-detected from tag (-rcN suffix -> true).',
        },
        repoPath: {
          type: 'string',
          description: 'Path to the local git repository (defaults to current working directory)',
        },
      },
      required: ['tag', 'targetBranch', 'notes'],
    },
  },
];

// ---------------------------------------------------------------------------
// Request dispatcher
// ---------------------------------------------------------------------------

function handleRequest(req) {
  const { id, method, params } = req;

  if (id === undefined || id === null) {
    return;
  }

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'github-release-server', version: '1.0.0' },
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
    try {
      let text;
      if (name === 'GitHubRelease') {
        text = createRelease(args || {});
      } else {
        sendError(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      sendResult(id, text);
    } catch (err) {
      sendResult(id, `Error: ${err.message}`);
    }
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
