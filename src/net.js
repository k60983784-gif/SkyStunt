// WebSocket client: join/create/quick-play, reconnect with the stored seat token, and message dispatch.
const TOKEN_KEY = 'skystunt.token';

export class NetClient {
  constructor(handlers) {
    this.h = handlers;           // { onStatus(status, detail), onWelcome(msg), onLobby(msg), onState(msg), onResults(msg), onError(msg), onNotice(msg) }
    this.ws = null;
    this.join = null;            // last join options (replayed on reconnect)
    this.token = sessionStorage.getItem(TOKEN_KEY) || '';
    this.attempts = 0;
    this.closedByUser = false;
    this.pingMs = null;
    this.pingTimer = null;
    this.url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }

  connect(joinOpts) {
    this.join = joinOpts;
    this.closedByUser = false;
    this.attempts = 0;
    this.open();
  }

  open() {
    this.h.onStatus('connecting', this.attempts ? `reconnecting (attempt ${this.attempts})` : 'connecting');
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { this.h.onStatus('offline', 'WebSocket not available'); return; }
    this.ws = ws;
    const openTimeout = setTimeout(() => { if (ws.readyState !== 1) ws.close(); }, 6000);
    ws.onopen = () => {
      clearTimeout(openTimeout);
      this.attempts = 0;
      this.h.onStatus('connected', '');
      this.send({ ...this.join, token: this.token || undefined });
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 2000);
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.t) {
        case 'welcome':
          this.token = m.token;
          sessionStorage.setItem(TOKEN_KEY, m.token);
          this.join = { ...this.join, code: m.room };
          this.h.onWelcome(m);
          break;
        case 'lobby': this.h.onLobby(m); break;
        case 'state': this.h.onState(m); break;
        case 'results': this.h.onResults(m); break;
        case 'error': this.h.onError(m); break;
        case 'notice': this.h.onNotice(m); break;
        case 'pong': this.pingMs = Math.max(0, Date.now() - m.ts); this.h.onPing(this.pingMs); break;
        default: break;
      }
    };
    ws.onclose = (ev) => {
      clearTimeout(openTimeout);
      clearInterval(this.pingTimer);
      if (this.closedByUser) { this.h.onStatus('closed', ''); return; }
      if (ev.code === 1008 || ev.code === 1009) { this.h.onStatus('offline', 'Connection closed by server (' + ev.code + ')'); return; }
      this.attempts++;
      if (this.attempts > 8) { this.h.onStatus('offline', 'Could not reach the server'); return; }
      const delay = Math.min(8000, 500 * 2 ** this.attempts);
      this.h.onStatus('reconnecting', `retrying in ${Math.round(delay / 1000)}s`);
      setTimeout(() => { if (!this.closedByUser) this.open(); }, delay);
    };
    ws.onerror = () => { /* onclose handles the retry */ };
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  disconnect() {
    this.closedByUser = true;
    clearInterval(this.pingTimer);
    try { this.send({ t: 'leave' }); } catch { /* ignore */ }
    try { this.ws && this.ws.close(1000, 'bye'); } catch { /* ignore */ }
    sessionStorage.removeItem(TOKEN_KEY);
    this.token = '';
  }
}
