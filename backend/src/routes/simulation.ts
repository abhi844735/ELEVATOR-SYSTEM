import { Router, Request, Response } from 'express';
import { MetricsService } from '../services/MetricsService';
import { SimulationEngine } from '../services/SimulationEngine';
import { ScenarioType } from '../types';

export function createSimulationRoutes(engine: SimulationEngine): Router {
  const router = Router();

  // GET /api/simulation/state
  router.get('/state', (_req: Request, res: Response) => {
    res.json({ success: true, data: engine.getState() });
  });

  // POST /api/simulation/start
  router.post('/start', (_req: Request, res: Response) => {
    engine.start();
    res.json({ success: true, message: 'Simulation started' });
  });

  // POST /api/simulation/stop
  router.post('/stop', (_req: Request, res: Response) => {
    engine.stop();
    res.json({ success: true, message: 'Simulation stopped' });
  });

  // POST /api/simulation/reset
  router.post('/reset', (_req: Request, res: Response) => {
    engine.reset();
    res.json({ success: true, message: 'Simulation reset' });
  });

  // PATCH /api/simulation/config
  router.patch('/config', (req: Request, res: Response) => {
    const config = req.body;
    engine.updateConfig(config);
    res.json({ success: true, data: engine.getState().config });
  });

  // POST /api/simulation/scenario
  router.post('/scenario', (req: Request, res: Response) => {
    const { scenario } = req.body as { scenario: ScenarioType };
    const valid: ScenarioType[] = ['NORMAL', 'MORNING_RUSH', 'EVENING_RUSH', 'LUNCH_PEAK', 'STRESS_TEST'];
    if (!valid.includes(scenario)) {
      res.status(400).json({ success: false, error: 'Invalid scenario' });
      return;
    }
    engine.setScenario(scenario);
    res.json({ success: true, scenario });
  });

  // POST /api/simulation/request — add manual request
  router.post('/request', (req: Request, res: Response) => {
    const { originFloor, destinationFloor } = req.body;
    if (typeof originFloor !== 'number' || typeof destinationFloor !== 'number') {
      res.status(400).json({ success: false, error: 'originFloor and destinationFloor required' });
      return;
    }
    const state = engine.getState();
    if (originFloor < 1 || originFloor > state.config.numFloors ||
        destinationFloor < 1 || destinationFloor > state.config.numFloors) {
      res.status(400).json({ success: false, error: 'Floor out of range' });
      return;
    }
    engine.addManualRequest(originFloor, destinationFloor);
    res.json({ success: true, message: 'Request added' });
  });

  return router;
}

export function createMetricsRoutes(engine: SimulationEngine): Router {
  const router = Router();

  // GET /api/metrics/sessions
  router.get('/sessions', async (_req: Request, res: Response) => {
    const sessions = await MetricsService.listSessions();
    res.json({ success: true, data: sessions });
  });

  // GET /api/metrics/session/:id
  router.get('/session/:id', async (req: Request, res: Response) => {
    const summary = await MetricsService.getSessionSummary(req.params.id);
    if (!summary) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    res.json({ success: true, data: summary });
  });

  // GET /api/metrics/live
  router.get('/live', (_req: Request, res: Response) => {
    res.json({ success: true, data: engine.getState().metrics });
  });

  return router;
}
