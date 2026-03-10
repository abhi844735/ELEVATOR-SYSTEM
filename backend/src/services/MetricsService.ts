import { MetricsModel } from '../models/Metrics';
import { SimulationState } from '../types';

export class MetricsService {
  /**
   * Persist a metrics snapshot to MongoDB every N ticks.
   */
  static async saveSnapshot(sessionId: string, state: SimulationState): Promise<void> {
    try {
      await MetricsModel.create({
        sessionId,
        tick: state.tick,
        scenario: state.scenario,
        metrics: state.metrics,
        numElevators: state.config.numElevators,
        numFloors: state.config.numFloors,
        recordedAt: new Date(),
      });
    } catch (err) {
      // Non-fatal – metrics persistence failures shouldn't crash the simulation
      console.warn('[MetricsService] Failed to save snapshot:', err);
    }
  }

  /**
   * Return aggregated metrics for a session (for the report page).
   */
  static async getSessionSummary(sessionId: string) {
    const snapshots = await MetricsModel.find({ sessionId }).sort({ tick: 1 }).lean();
    if (!snapshots.length) return null;

    const latest = snapshots[snapshots.length - 1];

    const avgWaitTimes = snapshots.map((s) => s.metrics.avgWaitTime).filter(Boolean);
    const avgTravelTimes = snapshots.map((s) => s.metrics.avgTravelTime).filter(Boolean);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      sessionId,
      scenario: latest.scenario,
      totalTicks: latest.tick,
      numElevators: latest.numElevators,
      numFloors: latest.numFloors,
      overallAvgWaitTime: avgWaitTimes.length ? Math.round(avg(avgWaitTimes) * 10) / 10 : 0,
      overallAvgTravelTime: avgTravelTimes.length ? Math.round(avg(avgTravelTimes) * 10) / 10 : 0,
      peakMetrics: latest.metrics,
      snapshotCount: snapshots.length,
    };
  }

  /**
   * List all sessions with their scenario and final metrics.
   */
  static async listSessions() {
    const sessions = await MetricsModel.aggregate([
      { $sort: { tick: -1 } },
      {
        $group: {
          _id: '$sessionId',
          scenario: { $first: '$scenario' },
          finalTick: { $first: '$tick' },
          finalMetrics: { $first: '$metrics' },
          numElevators: { $first: '$numElevators' },
          numFloors: { $first: '$numFloors' },
          recordedAt: { $first: '$recordedAt' },
        },
      },
      { $sort: { recordedAt: -1 } },
      { $limit: 20 },
    ]);
    return sessions;
  }
}
