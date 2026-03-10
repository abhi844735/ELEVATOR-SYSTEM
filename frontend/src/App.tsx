import React, { useEffect } from 'react';
import { useSimulationStore } from './store/simulationStore';
import { ElevatorShaft } from './components/ElevatorShaft';
import { ControlPanel } from './components/ControlPanel';
import { MetricsDashboard } from './components/MetricsDashboard';
import { RequestQueue } from './components/RequestQueue';

export default function App() {
  const { connect, state } = useSimulationStore();

  useEffect(() => {
    connect();
  }, []);

  const FLOOR_HEIGHT_PX = 64;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060609',
      color: '#ccc',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: '1px solid #111',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#070710',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 4,
            color: '#fff',
            fontFamily: '"Courier New", monospace',
          }}>
            ELEVATE
          </span>
          <span style={{ fontSize: 10, color: '#333', letterSpacing: 3 }}>DISPATCH CONTROL SYSTEM</span>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {state && (
            <>
              <HeaderStat label="SCENARIO" value={state.scenario.replace('_', ' ')} color="#a29bfe" />
              <HeaderStat label="ELEVATORS" value={state.config.numElevators} />
              <HeaderStat label="FLOORS" value={state.config.numFloors} />
              <HeaderStat
                label="STATUS"
                value={state.isRunning ? 'RUNNING' : 'STOPPED'}
                color={state.isRunning ? '#00e5a0' : '#ff6b6b'}
              />
            </>
          )}
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '260px 1fr 320px',
        gap: 0,
        overflow: 'hidden',
      }}>

        {/* ── Left panel: Controls ─────────────────────────────────────────── */}
        <div style={{
          borderRight: '1px solid #111',
          padding: '0 20px',
          overflowY: 'auto',
          background: '#07070f',
        }}>
          <ControlPanel />
        </div>

        {/* ── Centre: Elevator Shafts ───────────────────────────────────────── */}
        <div style={{
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {!state ? (
            <div style={{
              color: '#2a2a3a',
              fontFamily: 'monospace',
              fontSize: 13,
              marginTop: 80,
              letterSpacing: 3,
            }}>
              CONNECTING TO SIM SERVER…
            </div>
          ) : (
            <>
              {/* Floor labels column + shafts */}
              <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
                {/* Floor labels */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: 32,
                  marginRight: 8,
                  marginTop: 40, // account for elevator label + gap
                }}>
                  {Array.from({ length: state.config.numFloors }, (_, i) => {
                    const floor = state.config.numFloors - i;
                    const isLobby = floor === 1;
                    return (
                      <div
                        key={floor}
                        style={{
                          height: FLOOR_HEIGHT_PX,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 8,
                        }}
                      >
                        <span style={{
                          fontSize: 10,
                          fontFamily: 'monospace',
                          color: isLobby ? '#ffd166' : '#2a2a3a',
                          fontWeight: isLobby ? 700 : 400,
                        }}>
                          {isLobby ? 'L' : floor}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Shafts */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {state.elevators.map((elevator) => (
                    <ElevatorShaft
                      key={elevator.id}
                      elevator={elevator}
                      numFloors={state.config.numFloors}
                      pendingRequests={state.pendingRequests}
                      tick={state.tick}
                    />
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div style={{
                display: 'flex',
                gap: 20,
                marginTop: 24,
                padding: '10px 16px',
                background: '#0a0a12',
                borderRadius: 6,
                border: '1px solid #1a1a2a',
              }}>
                <LegendItem color="#00e5a0" label="Moving Up / Up Call" />
                <LegendItem color="#ff6b6b" label="Moving Down / Down Call" />
                <LegendItem color="#ffd166" label="Door Open / Lobby" />
                <LegendItem color="#a29bfe" label="Target floor" />
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: Metrics + Queue ─────────────────────────────────── */}
        <div style={{
          borderLeft: '1px solid #111',
          padding: '20px',
          overflowY: 'auto',
          background: '#07070f',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {state && (
            <>
              <MetricsDashboard />
              <div style={{ borderTop: '1px solid #111', paddingTop: 20 }}>
                <RequestQueue
                  pendingRequests={state.pendingRequests}
                  tick={state.tick}
                  numFloors={state.config.numFloors}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #060609; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a12; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 2px; }
        @keyframes doorSlideLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @keyframes doorSlideRight {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        input[type=range] { cursor: pointer; height: 3px; }
        select { cursor: pointer; outline: none; }
        button:hover { opacity: 0.85; }
        button:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
}

// ─── Header stat ─────────────────────────────────────────────────────────────

const HeaderStat: React.FC<{ label: string; value: string | number; color?: string }> = ({
  label, value, color = '#888',
}) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: 8, letterSpacing: 2, color: '#333' }}>{label}</div>
    <div style={{ fontSize: 12, color, fontWeight: 700, letterSpacing: 1 }}>{value}</div>
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
    <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#444' }}>{label}</span>
  </div>
);
