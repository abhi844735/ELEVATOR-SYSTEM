import React, { useEffect, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationMetrics } from '../types';

interface MetricHistory {
  tick: number;
  avgWait: number;
  avgTravel: number;
  pending: number;
  served: number;
}

const MAX_HISTORY = 60;

export const MetricsDashboard: React.FC = () => {
  const { state } = useSimulationStore();
  const historyRef = useRef<MetricHistory[]>([]);
  const [history, setHistory] = useState<MetricHistory[]>([]);

  useEffect(() => {
    if (!state || !state.isRunning) return;
    if (state.tick % 3 !== 0) return; // Sample every 3 ticks to avoid too-frequent re-renders

    const point: MetricHistory = {
      tick: state.tick,
      avgWait: state.metrics.avgWaitTime,
      avgTravel: state.metrics.avgTravelTime,
      pending: state.metrics.totalRequestsPending,
      served: state.metrics.totalRequestsServed,
    };

    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), point];
    setHistory([...historyRef.current]);
  }, [state?.tick]);

  if (!state) return null;

  const { metrics, elevators, config } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <KPI label="AVG WAIT" value={`${metrics.avgWaitTime}t`} color="#00e5a0"
          sub={`max ${metrics.maxWaitTime}t`} />
        <KPI label="AVG TRAVEL" value={`${metrics.avgTravelTime}t`} color="#a29bfe"
          sub={`max ${metrics.maxTravelTime}t`} />
        <KPI label="SERVED" value={metrics.totalRequestsServed} color="#ffd166"
          sub={`${metrics.throughput}/100t`} />
        <KPI label="PENDING" value={metrics.totalRequestsPending} color="#ff6b6b"
          sub={`${metrics.starvedRequests} starved`} />
      </div>

      {/* Time-series chart */}
      <div style={chartCardStyle}>
        <ChartTitle>Wait & Travel Time (ticks)</ChartTitle>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="tick" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avgWait" stroke="#00e5a0" strokeWidth={1.5}
              dot={false} name="Avg Wait" />
            <Line type="monotone" dataKey="avgTravel" stroke="#a29bfe" strokeWidth={1.5}
              dot={false} name="Avg Travel" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pending vs Served */}
      <div style={chartCardStyle}>
        <ChartTitle>Pending vs Served Requests</ChartTitle>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="tick" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="pending" stroke="#ff6b6b" strokeWidth={1.5}
              dot={false} name="Pending" />
            <Line type="monotone" dataKey="served" stroke="#ffd166" strokeWidth={1.5}
              dot={false} name="Served" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Elevator utilization bars */}
      <div style={chartCardStyle}>
        <ChartTitle>Elevator Utilization %</ChartTitle>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart
            data={elevators.map((e, i) => ({
              name: `E${i + 1}`,
              utilization: metrics.elevatorUtilization[i] ?? 0,
              passengers: e.passengers.length,
            }))}
            margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="utilization" radius={[3, 3, 0, 0]}>
              {elevators.map((_, i) => (
                <Cell
                  key={i}
                  fill={(metrics.elevatorUtilization[i] ?? 0) > 80 ? '#ff6b6b' : '#a29bfe'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-elevator detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(elevators.length, 3)}, 1fr)`, gap: 8 }}>
        {elevators.map((e, i) => (
          <div key={e.id} style={{
            background: '#0a0a12',
            border: '1px solid #1a1a2a',
            borderRadius: 6,
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#555', marginBottom: 4, letterSpacing: 2 }}>
              E{i + 1} · Floor {e.currentFloor}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Stat label="pax" value={`${e.passengers.length}/${e.capacity}`} />
              <Stat label="served" value={e.totalPassengersServed} />
              <Stat label="util%" value={`${metrics.elevatorUtilization[i] ?? 0}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const KPI: React.FC<{ label: string; value: number | string; color: string; sub?: string }> = ({
  label, value, color, sub,
}) => (
  <div style={{
    background: `${color}08`,
    border: `1px solid ${color}22`,
    borderRadius: 8,
    padding: '10px 12px',
  }}>
    <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#444', letterSpacing: 2, marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontFamily: 'monospace', color, fontWeight: 700, lineHeight: 1 }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#333', marginTop: 4 }}>{sub}</div>
    )}
  </div>
);

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 8, fontFamily: 'monospace', color: '#333' }}>{label}</div>
    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#888' }}>{value}</div>
  </div>
);

const ChartTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#333', letterSpacing: 2, marginBottom: 8 }}>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0e0e18',
      border: '1px solid #1e1e2e',
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'monospace',
      fontSize: 10,
    }}>
      {label !== undefined && <div style={{ color: '#444', marginBottom: 4 }}>t={label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

const tickStyle = { fontSize: 9, fontFamily: 'monospace', fill: '#333' };
const chartCardStyle: React.CSSProperties = {
  background: '#0a0a12',
  border: '1px solid #1a1a2a',
  borderRadius: 8,
  padding: '12px 14px',
};
