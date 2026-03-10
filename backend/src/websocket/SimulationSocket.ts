import { WebSocket, WebSocketServer } from 'ws';
import { SimulationEngine } from '../services/SimulationEngine';
import { MetricsService } from '../services/MetricsService';
import { WSMessage, SimulationState, ScenarioType } from '../types';

const METRICS_PERSIST_INTERVAL = 50; // Save snapshot every 50 ticks

export function initWebSocket(wss: WebSocketServer, engine: SimulationEngine): void {
  const clients = new Set<WebSocket>();

  // Broadcast updated state to all connected clients
  const broadcast = (state: SimulationState): void => {
    const msg: WSMessage = {
      type: 'STATE_UPDATE',
      payload: state,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(msg);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }

    // Persist metrics snapshot periodically
    if (state.tick > 0 && state.tick % METRICS_PERSIST_INTERVAL === 0) {
      MetricsService.saveSnapshot(engine.getSessionId(), state).catch(() => {});
    }
  };

  // Register engine callback
  // (We re-register on each connection because the engine is a singleton)
  engine['onStateUpdate'] = broadcast;

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    // Send current state immediately upon connection
    const initMsg: WSMessage = {
      type: 'STATE_UPDATE',
      payload: engine.getState(),
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(initMsg));

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        handleClientMessage(msg, engine);
      } catch (err) {
        console.error('[WS] Bad message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err);
      clients.delete(ws);
    });
  });
}

function handleClientMessage(msg: WSMessage, engine: SimulationEngine): void {
  switch (msg.type) {
    case 'SIMULATION_START':
      engine.start();
      break;
    case 'SIMULATION_STOP':
      engine.stop();
      break;
    case 'SIMULATION_RESET':
      engine.reset();
      break;
    case 'CONFIG_UPDATE': {
      const config = msg.payload as Record<string, unknown>;
      engine.updateConfig(config as Parameters<typeof engine.updateConfig>[0]);
      break;
    }
    case 'SCENARIO_CHANGE': {
      const { scenario } = msg.payload as { scenario: ScenarioType };
      engine.setScenario(scenario);
      break;
    }
    case 'MANUAL_REQUEST': {
      const { originFloor, destinationFloor } = msg.payload as {
        originFloor: number;
        destinationFloor: number;
      };
      engine.addManualRequest(originFloor, destinationFloor);
      break;
    }
    default:
      console.warn('[WS] Unknown message type:', msg.type);
  }
}
