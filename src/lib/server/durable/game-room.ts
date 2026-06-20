import { DurableObject } from 'cloudflare:workers';

/**
 * GameRoom — one Durable Object per room code, authority for live game state.
 *
 * Phase 0 stub: accepts a hibernatable WebSocket and echoes frames so the
 * single-worker re-export seam (src/worker.ts) can be validated end-to-end.
 * The real protocol + pure `reduce` wiring lands in Phase 3 (docs/03).
 */
export class GameRoom extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('upgrade') !== 'websocket') {
			return new Response('expected websocket upgrade', { status: 426 });
		}

		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server); // hibernation API
		return new Response(null, { status: 101, webSocket: client });
	}

	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		ws.send(typeof message === 'string' ? `echo:${message}` : '[binary]');
	}

	webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
	}
}
