'use strict';

// MCP stdio server — Glob + Grep tools
// Node built-ins only; no npm dependencies.

const { execSync } = require('child_process');
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
// Glob tool implementation
// ---------------------------------------------------------------------------

/**
 * Convert a glob pattern (with optional base path override) to a `find` command
 * and execute it. Returns newline-joined paths or '(no results)'.
 */
function runGlob({ pattern, path: basePath }) {
  const searchPath = basePath || '.';

  // Split pattern into segments
  const segments = pattern.split('/');

  // Find the first segment that contains a wildcard
  let staticSegments = [];
  let wildcardStart = -1;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].includes('*') || segments[i].includes('?')) {
      wildcardStart = i;
      break;
    }
    staticSegments.push(segments[i]);
  }

  // Remaining segments after static prefix
  const dynamicSegments = wildcardStart >= 0 ? segments.slice(wildcardStart) : segments;

  // The filename pattern is the last segment
  const filePattern = dynamicSegments[dynamicSegments.length - 1];

  // Directory segments between static prefix and filename
  const dirSegments = dynamicSegments.slice(0, dynamicSegments.length - 1);

  // Build the find base dir: searchPath + static prefix
  let findBase = searchPath;
  if (staticSegments.length > 0) {
    // Avoid double-slash
    findBase = searchPath.replace(/\/+$/, '') + '/' + staticSegments.join('/');
  }

  // Determine maxdepth
  const hasRecursiveGlob = dirSegments.some((s) => s === '**');
  let maxDepthFlag = '';
  if (!hasRecursiveGlob) {
    const depth = dirSegments.length + 1;
    maxDepthFlag = `-maxdepth ${depth}`;
  }

  // Escape single quotes in filePattern for shell
  const safeFilePattern = filePattern.replace(/'/g, "'\\''");

  const cmd = `find ${findBase} ${maxDepthFlag} -name '${safeFilePattern}' -not -path '*/.git/*' 2>/dev/null | sort`;

  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const trimmed = output.trim();
    return trimmed.length > 0 ? trimmed : '(no results)';
  } catch (err) {
    const output = (err.stdout || '').trim();
    return output.length > 0 ? output : '(no results)';
  }
}

// ---------------------------------------------------------------------------
// Grep tool implementation
// ---------------------------------------------------------------------------

function runGrep({ pattern, path: searchPath, glob, type, '-i': caseInsensitive, output_mode, context, head_limit }) {
  const base = searchPath || '.';
  const mode = output_mode || 'files_with_matches';

  // Detect rg
  let hasRg = false;
  try {
    execSync('which rg', { stdio: 'ignore' });
    hasRg = true;
  } catch (_) {
    hasRg = false;
  }

  let cmd;

  if (hasRg) {
    const flags = ['--no-heading'];
    if (caseInsensitive) flags.push('-i');
    if (glob) flags.push(`--glob '${glob.replace(/'/g, "'\\''")}'`);
    if (type) flags.push(`--type '${type.replace(/'/g, "'\\''")}'`);
    if (mode === 'files_with_matches') flags.push('-l');
    else if (mode === 'count') flags.push('-c');
    if (context != null && mode === 'content') flags.push(`-C ${Number(context)}`);
    flags.push(`-- '${pattern.replace(/'/g, "'\\''")}'`);
    flags.push(`'${base.replace(/'/g, "'\\''")}'`);
    cmd = `rg ${flags.join(' ')} 2>/dev/null`;
  } else {
    // grep fallback
    const flags = ['-r', '-E'];
    if (caseInsensitive) flags.push('-i');
    if (glob) flags.push(`--include='${glob.replace(/'/g, "'\\''")}'`);
    if (mode === 'files_with_matches') flags.push('-l');
    else if (mode === 'count') flags.push('-c');
    if (context != null && mode === 'content') flags.push(`-C ${Number(context)}`);
    flags.push(`-- '${pattern.replace(/'/g, "'\\''")}'`);
    flags.push(`'${base.replace(/'/g, "'\\''")}'`);
    cmd = `grep ${flags.join(' ')} 2>/dev/null`;
  }

  let output = '';
  try {
    output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    // grep/rg exit 1 means no matches (not an error per se)
    output = err.stdout || '';
  }

  output = output.trim();

  if (head_limit != null && output.length > 0) {
    const lines = output.split('\n');
    output = lines.slice(0, Number(head_limit)).join('\n');
  }

  return output.length > 0 ? output : '(no results)';
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'Glob',
    description: 'Fast file pattern matching tool. Returns matching file paths sorted by modification time.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern to match files against' },
        path: { type: 'string', description: 'Directory to search in (optional)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Grep',
    description: 'Search file contents with regex. Supports glob filter, type filter, context lines, and output modes.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to search for' },
        path: { type: 'string', description: 'File or directory to search in (optional)' },
        glob: { type: 'string', description: 'Glob pattern to filter files (e.g. "*.ts")' },
        type: { type: 'string', description: 'File type to search (e.g. "js", "py")' },
        '-i': { type: 'boolean', description: 'Case insensitive search' },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode (default: files_with_matches)',
        },
        context: { type: 'number', description: 'Lines of context around matches (content mode only)' },
        head_limit: { type: 'number', description: 'Limit output to first N lines' },
      },
      required: ['pattern'],
    },
  },
];

// ---------------------------------------------------------------------------
// Request dispatcher
// ---------------------------------------------------------------------------

function handleRequest(req) {
  const { jsonrpc, id, method, params } = req;

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
        serverInfo: { name: 'glob-grep-server', version: '1.0.0' },
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
      if (name === 'Glob') {
        text = runGlob(args || {});
      } else if (name === 'Grep') {
        text = runGrep(args || {});
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
