import { create } from 'zustand';
import { SimulationState, SimulationConfig, ScenarioType, WSMessage } from '../types';

interface SimulationStore {
  state: SimulationState | null;
  wsConnected: boolean;
  ws: WebSocket | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (msg: WSMessage) => void;

  // Simulation controls
  startSimulation: () => void;
  stopSimulation: () => void;
  resetSimulation: () => void;
  updateConfig: (config: Partial<SimulationConfig>) => void;
  setScenario: (scenario: ScenarioType) => void;
  addManualRequest: (originFloor: number, destinationFloor: number) => void;
}

const WS_URL =import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  state: null,
  wsConnected: false,
  ws: null,

  connect: () => {
    const existing = get().ws;
    if (existing && existing.readyState < 2) return; // Already connecting/open

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ wsConnected: true });
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        if (msg.type === 'STATE_UPDATE') {
          set({ state: msg.payload as SimulationState });
        }
      } catch (e) {
        console.error('[WS] Parse error', e);
      }
    };

    ws.onclose = () => {
      set({ wsConnected: false, ws: null });
      console.log('[WS] Disconnected – reconnecting in 3s...');
      setTimeout(() => get().connect(), 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error', err);
    };

    set({ ws });
  },

  disconnect: () => {
    get().ws?.close();
    set({ ws: null, wsConnected: false });
  },

  sendMessage: (msg) => {
    const { ws } = get();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  startSimulation: () =>
    get().sendMessage({ type: 'SIMULATION_START', payload: {}, timestamp: Date.now() }),

  stopSimulation: () =>
    get().sendMessage({ type: 'SIMULATION_STOP', payload: {}, timestamp: Date.now() }),

  resetSimulation: () =>
    get().sendMessage({ type: 'SIMULATION_RESET', payload: {}, timestamp: Date.now() }),

  updateConfig: (config) =>
    get().sendMessage({ type: 'CONFIG_UPDATE', payload: config, timestamp: Date.now() }),

  setScenario: (scenario) =>
    get().sendMessage({ type: 'SCENARIO_CHANGE', payload: { scenario }, timestamp: Date.now() }),

  addManualRequest: (originFloor, destinationFloor) =>
    get().sendMessage({
      type: 'MANUAL_REQUEST',
      payload: { originFloor, destinationFloor },
      timestamp: Date.now(),
    }),
}));
