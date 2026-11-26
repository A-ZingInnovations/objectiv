import { createRequire } from 'node:module';
import { broadcastEvent } from './events.js';

const require = createRequire(import.meta.url);

type WsSocket = {
  send(data: string): void;
  close(): void;
  pong(data?: Buffer): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'ping', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
};

type WsConstructor = new (url: string) => WsSocket;

const WebSocket = require('ws') as WsConstructor;

export type SlackSocketEvent = {
  kind: string;
  teamId: string;
  channelId: string;
  ts: string;
  userId?: string;
  text?: string;
  reaction?: string;
};

type SlackSocketStatus = {
  connected: boolean;
  detail: string;
};

type ConnectionsOpenResponse = {
  ok: boolean;
  error?: string;
  url?: string;
};

type SocketEnvelope = {
  type: string;
  envelope_id?: string;
  payload?: Record<string, unknown>;
};

function emitStatus(connected: boolean, detail: string): void {
  const payload: SlackSocketStatus = { connected, detail };
  broadcastEvent('slack-socket-status', payload);
}

function emitEvent(event: SlackSocketEvent): void {
  broadcastEvent('slack-socket-event', event);
}

function strField(v: Record<string, unknown>, key: string): string | undefined {
  const x = v[key];
  return typeof x === 'string' ? x : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectionsOpen(appToken: string): Promise<string> {
  const resp = await fetch('https://slack.com/api/apps.connections.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await resp.json()) as ConnectionsOpenResponse;
  if (!body.ok) {
    throw new Error(body.error ?? 'apps.connections.open failed');
  }
  const url = body.url?.trim();
  if (!url) throw new Error('apps.connections.open missing url');
  return url;
}

function ack(ws: WsSocket, envelopeId: string): void {
  ws.send(JSON.stringify({ envelope_id: envelopeId }));
}

function parseEventsApi(payload: Record<string, unknown>): void {
  const teamId = strField(payload, 'team_id') ?? '';
  const event = payload.event;
  if (!event || typeof event !== 'object' || Array.isArray(event)) return;
  const ev = event as Record<string, unknown>;
  const eventType = strField(ev, 'type') ?? '';

  switch (eventType) {
    case 'message': {
      if (strField(ev, 'subtype') === 'message_changed') return;
      const channelId = strField(ev, 'channel') ?? '';
      const ts = strField(ev, 'ts') ?? '';
      if (!channelId || !ts) return;
      emitEvent({
        kind: 'message',
        teamId,
        channelId,
        ts,
        userId: strField(ev, 'user'),
        text: strField(ev, 'text'),
      });
      break;
    }
    case 'message_changed': {
      const channelId = strField(ev, 'channel') ?? '';
      const msgRaw = ev.message;
      const msg =
        msgRaw && typeof msgRaw === 'object' && !Array.isArray(msgRaw)
          ? (msgRaw as Record<string, unknown>)
          : ev;
      const ts = strField(msg, 'ts') ?? '';
      if (!channelId || !ts) return;
      emitEvent({
        kind: 'message_changed',
        teamId,
        channelId,
        ts,
        userId: strField(msg, 'user'),
        text: strField(msg, 'text'),
      });
      break;
    }
    case 'reaction_added':
    case 'reaction_removed': {
      const item = ev.item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const it = item as Record<string, unknown>;
      if (strField(it, 'type') !== 'message') return;
      const channelId = strField(it, 'channel') ?? '';
      const ts = strField(it, 'ts') ?? '';
      if (!channelId || !ts) return;
      emitEvent({
        kind: eventType,
        teamId,
        channelId,
        ts,
        userId: strField(ev, 'user'),
        reaction: strField(ev, 'reaction'),
      });
      break;
    }
    default:
      break;
  }
}

function handleEnvelope(ws: WsSocket, raw: string): void {
  let envelope: SocketEnvelope;
  try {
    envelope = JSON.parse(raw) as SocketEnvelope;
  } catch {
    return;
  }

  if (envelope.envelope_id) {
    ack(ws, envelope.envelope_id);
  }

  switch (envelope.type) {
    case 'hello':
      emitStatus(true, 'Socket Mode connected');
      break;
    case 'disconnect':
      emitStatus(false, 'Socket Mode disconnected');
      break;
    case 'events_api':
      if (envelope.payload) parseEventsApi(envelope.payload);
      break;
    default:
      break;
  }
}

function socketSession(appToken: string, shouldStop: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    void (async () => {
      let url: string;
      try {
        url = await connectionsOpen(appToken);
      } catch (e) {
        reject(e);
        return;
      }

      const ws = new WebSocket(url);
      currentWs = ws;

      ws.on('open', () => {
        emitStatus(true, 'Socket Mode live');
      });

      ws.on('message', (data) => {
        if (shouldStop()) return;
        const text = typeof data === 'string' ? data : data.toString('utf8');
        handleEnvelope(ws, text);
      });

      ws.on('ping', (data) => {
        ws.pong(data);
      });

      ws.on('close', () => {
        currentWs = null;
        if (shouldStop()) {
          resolve();
        } else {
          reject(new Error('WebSocket closed'));
        }
      });

      ws.on('error', (err) => {
        if (!shouldStop()) reject(err);
      });

      const poll = setInterval(() => {
        if (shouldStop()) {
          clearInterval(poll);
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }
      }, 200);
    })();
  });
}

let stopRequested = true;
let loopPromise: Promise<void> | null = null;
let currentWs: WsSocket | null = null;

async function socketLoop(appToken: string): Promise<void> {
  let backoffSecs = 2;
  while (!stopRequested) {
    emitStatus(false, 'Connecting Socket Mode…');
    try {
      await socketSession(appToken, () => stopRequested);
      break;
    } catch (e) {
      if (stopRequested) break;
      const msg = e instanceof Error ? e.message : String(e);
      const detail = msg.toLowerCase().includes('ratelimit')
        ? 'Slack rate limit — Socket Mode retrying…'
        : `Socket Mode: ${msg} — retrying…`;
      emitStatus(false, detail);
      await sleep(backoffSecs * 1000);
      backoffSecs = Math.min(backoffSecs * 2, 60);
    }
  }
  emitStatus(false, 'Socket Mode stopped');
}

class SlackSocketService {
  async start(appToken: string): Promise<void> {
    const token = appToken.trim();
    if (!token) {
      throw new Error('Missing Slack app token (xapp-…) for Socket Mode');
    }
    if (!token.startsWith('xapp-')) {
      throw new Error('Slack app token must start with xapp-');
    }

    await this.stop();

    stopRequested = false;
    const running = socketLoop(token);
    loopPromise = running;
    void running.finally(() => {
      loopPromise = null;
    });
  }

  async stop(): Promise<void> {
    stopRequested = true;
    try {
      currentWs?.close();
    } catch {
      /* ignore */
    }
    currentWs = null;
    if (loopPromise) {
      await loopPromise.catch(() => {});
      loopPromise = null;
    }
  }

  isRunning(): boolean {
    return loopPromise !== null && !stopRequested;
  }
}

const slackSocketService = new SlackSocketService();

export async function handleSlackSocketCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'slack_socket_start': {
      const appToken =
        typeof args.appToken === 'string'
          ? args.appToken
          : typeof args.app_token === 'string'
            ? args.app_token
            : '';
      await slackSocketService.start(appToken);
      return null;
    }
    case 'slack_socket_stop':
      await slackSocketService.stop();
      return null;
    case 'slack_socket_is_running':
      return slackSocketService.isRunning();
    default:
      return undefined;
  }
}