/**
 * EO WebSocket Bridge
 *
 * A lightweight WebSocket-to-TCP proxy for Endless Online servers.
 * Correctly frames EO packets using the 2-byte EO length prefix so
 * each WebSocket message contains exactly one complete EO packet.
 *
 * Usage:
 *   node bridge.js [ws_port] [eo_host] [eo_port]
 *
 * Defaults:
 *   ws_port  = 8080
 *   eo_host  = 127.0.0.1
 *   eo_port  = 8078
 */

const net = require('node:net');
const { WebSocketServer } = require('ws');

const WS_PORT = Number.parseInt(process.argv[2] || '8080', 10);
const EO_HOST = process.argv[3] || '127.0.0.1';
const EO_PORT = Number.parseInt(process.argv[4] || '8078', 10);

/** Decode a 2-byte EO-encoded number. */
function eoDecodeNumber(b1, b2) {
  let val = 0;
  if (b1 !== 0xfe) val += b1 - 1;
  if (b2 !== 0xfe) val += 253 * (b2 - 1);
  return val;
}

const wss = new WebSocketServer({ host: '0.0.0.0', port: WS_PORT });

console.log(
  `[bridge] Listening on ws://0.0.0.0:${WS_PORT}  →  ${EO_HOST}:${EO_PORT}`,
);

wss.on('connection', (ws, req) => {
  const clientAddr =
    req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  console.log(`[bridge] WS client connected from ${clientAddr}`);

  // Open TCP connection to the EO server
  const tcp = new net.Socket();
  let tcpBuffer = Buffer.alloc(0);
  let alive = true;

  const cleanup = () => {
    if (!alive) return;
    alive = false;
    try {
      ws.close();
    } catch (_) {}
    try {
      tcp.destroy();
    } catch (_) {}
    console.log(`[bridge] Session ended for ${clientAddr}`);
  };

  tcp.connect(EO_PORT, EO_HOST, () => {
    console.log(`[bridge] TCP connected to ${EO_HOST}:${EO_PORT}`);
  });

  // ───────────────────────────────────────────
  // WebSocket → TCP  (forward raw bytes)
  // ───────────────────────────────────────────
  ws.on('message', (data) => {
    if (!alive) return;
    // The web client sends complete EO packets (including length prefix).
    // Just forward them as-is to the TCP server.
    tcp.write(data);
  });

  // ───────────────────────────────────────────
  // TCP → WebSocket  (frame EO packets)
  // ───────────────────────────────────────────
  tcp.on('data', (chunk) => {
    if (!alive) return;

    // Accumulate TCP data
    tcpBuffer = Buffer.concat([tcpBuffer, chunk]);

    // Process complete EO packets from the buffer
    while (tcpBuffer.length >= 2) {
      const packetLen = eoDecodeNumber(tcpBuffer[0], tcpBuffer[1]);
      const totalLen = 2 + packetLen; // length prefix + body

      if (tcpBuffer.length < totalLen) {
        // Not enough data yet — wait for more
        break;
      }

      // Extract the complete packet (including the 2-byte length prefix)
      const packet = tcpBuffer.subarray(0, totalLen);

      // Send as one WebSocket message
      ws.send(packet, { binary: true });

      // Advance past this packet
      tcpBuffer = tcpBuffer.subarray(totalLen);
    }
  });

  // ───────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────
  tcp.on('error', (err) => {
    console.error(`[bridge] TCP error: ${err.message}`);
    cleanup();
  });

  tcp.on('close', () => {
    console.log('[bridge] TCP closed');
    cleanup();
  });

  ws.on('close', () => {
    console.log('[bridge] WS closed');
    cleanup();
  });

  ws.on('error', (err) => {
    console.error(`[bridge] WS error: ${err.message}`);
    cleanup();
  });
});
