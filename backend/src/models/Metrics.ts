import mongoose, { Schema, Document } from 'mongoose';
import { SimulationMetrics, ScenarioType } from '../types';

export interface IMetricsSnapshot extends Document {
  sessionId: string;
  tick: number;
  scenario: ScenarioType;
  metrics: SimulationMetrics;
  numElevators: number;
  numFloors: number;
  recordedAt: Date;
}

const MetricsSchema = new Schema<IMetricsSnapshot>(
  {
    sessionId: { type: String, required: true, index: true },
    tick: { type: Number, required: true },
    scenario: {
      type: String,
      enum: ['NORMAL', 'MORNING_RUSH', 'EVENING_RUSH', 'LUNCH_PEAK', 'STRESS_TEST'],
    },
    metrics: {
      avgWaitTime: Number,
      maxWaitTime: Number,
      avgTravelTime: Number,
      maxTravelTime: Number,
      totalRequestsServed: Number,
      totalRequestsPending: Number,
      elevatorUtilization: [Number],
      throughput: Number,
      starvedRequests: Number,
      peakWaitTime: Number,
    },
    numElevators: Number,
    numFloors: Number,
    recordedAt: { type: Date, default: Date.now },
  },
  { collection: 'metrics_snapshots' }
);

export const MetricsModel = mongoose.model<IMetricsSnapshot>('MetricsSnapshot', MetricsSchema);
