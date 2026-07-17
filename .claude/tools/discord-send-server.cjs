'use strict';

// MCP stdio server — sends a message to a Discord channel as the configured
// bot. Reads DISCORD_BOT_TOKEN from ~/.claude/channels/discord/.env.
// Node built-ins only; no npm deps.

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const readline = require('readline');

const ENV_FILE = path.join(os.homedir(), '.claude', 'channels', 'discord', '.env');

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
// Token loading
// ---------------------------------------------------------------------------

function readBotToken() {
  if (!fs.existsSync(ENV_FILE)) {
    return null;
  }
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const match = content.match(/^DISCORD_BOT_TOKEN=(.+)$/m);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// DiscordSend tool implementation
// ---------------------------------------------------------------------------

function postMessage(channelId, content, token) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ content });
    const req = https.request(
      {
        hostname: 'discord.com',
        path: `/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.write(payload);
    req.end();
  });
}

async function discordSend({ channelId, message }) {
  if (!channelId) {
    return 'Error: "channelId" is required.';
  }
  if (!message) {
    return 'Error: "message" is required.';
  }

  const token = readBotToken();
  if (!token) {
    return `Error: DISCORD_BOT_TOKEN not found in ${ENV_FILE}. Run /discord:configure <token> first.`;
  }

  const { status, body } = await postMessage(channelId, message, token);

  if (status >= 200 && status < 300) {
    return `Message sent to channel ${channelId} (HTTP ${status}).`;
  }
  return `Error: failed to send message (HTTP ${status}): ${body}`;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'DiscordSend',
    description:
      'Send a message to a Discord channel as the configured bot, using a saved bot token (~/.claude/channels/discord/.env). The bot must already be a member of the server owning the channel, with Send Messages permission. Use for proactively pushing a message to a known channel ID — not for replying to inbound DMs (that flow uses the discord plugin\'s own reply tool).',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Discord channel snowflake ID to send the message to' },
        message: { type: 'string', description: 'Message text to send' },
      },
      required: ['channelId', 'message'],
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
        serverInfo: { name: 'discord-send-server', version: '1.0.0' },
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
    if (name !== 'DiscordSend') {
      sendError(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    discordSend(args || {})
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
