import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { SimulationEngine } from './services/SimulationEngine';
import { initWebSocket } from './websocket/SimulationSocket';
import { createSimulationRoutes, createMetricsRoutes } from './routes/simulation';
import { SimulationState } from './types';

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/elevator_sim';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// ─── Simulation Engine (singleton) ────────────────────────────────────────────

// Placeholder callback; gets overwritten by WebSocket init
const onStateUpdate = (_state: SimulationState): void => {};
const engine = new SimulationEngine(onStateUpdate);

// ─── WebSocket ────────────────────────────────────────────────────────────────

initWebSocket(wss, engine);

// ─── REST Routes ──────────────────────────────────────────────────────────────

app.use('/api/simulation', createSimulationRoutes(engine));
app.use('/api/metrics', createMetricsRoutes(engine));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    tick: engine.getState().tick,
    isRunning: engine.getState().isRunning,
    mongoConnected: mongoose.connection.readyState === 1,
  });
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[MongoDB] Connected to ${MONGODB_URI}`);
  } catch (err) {
    console.warn('[MongoDB] Could not connect – metrics persistence disabled:', (err as Error).message);
  }

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[WS]     WebSocket on ws://localhost:${PORT}/ws`);
  });
}

startServer();
