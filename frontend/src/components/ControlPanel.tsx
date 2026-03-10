import React, { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ScenarioType, SimulationConfig } from '../types';

const SCENARIOS: { label: string; value: ScenarioType; color: string; desc: string }[] = [
  { label: 'Normal', value: 'NORMAL', color: '#00e5a0', desc: 'Random traffic' },
  { label: 'Morning Rush', value: 'MORNING_RUSH', color: '#ffd166', desc: '70% from lobby ↑' },
  { label: 'Evening Rush', value: 'EVENING_RUSH', color: '#ff9f43', desc: '65% to lobby ↓' },
  { label: 'Lunch Peak', value: 'LUNCH_PEAK', color: '#a29bfe', desc: 'Mid-floor traffic' },
  { label: 'Stress Test', value: 'STRESS_TEST', color: '#ff6b6b', desc: '100+ simultaneous' },
];

const SPEEDS = [1, 2, 5] as const;

export const ControlPanel: React.FC = () => {
  const { state, wsConnected, startSimulation, stopSimulation, resetSimulation,
          updateConfig, setScenario, addManualRequest } = useSimulationStore();

  const [manualOrigin, setManualOrigin] = useState(1);
  const [manualDest, setManualDest] = useState(5);

  if (!state) return null;

  const { config, isRunning, scenario } = state;
  const numFloors = config.numFloors;

  const handleConfigChange = (key: keyof SimulationConfig, value: number | boolean) => {
    updateConfig({ [key]: value });
  };

  const handleManualRequest = () => {
    if (manualOrigin === manualDest) return;
    addManualRequest(manualOrigin, manualDest);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '20px 0',
      minWidth: 280,
    }}>
      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: wsConnected ? '#00e5a0' : '#ff6b6b',
          boxShadow: wsConnected ? '0 0 8px #00e5a0' : '0 0 8px #ff6b6b',
        }} />
        <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>
          {wsConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
        {state && (
          <span style={{ fontSize: 11, color: '#333', fontFamily: 'monospace', marginLeft: 'auto' }}>
            TICK {state.tick}
          </span>
        )}
      </div>

      {/* Playback controls */}
      <Section title="CONTROLS">
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={isRunning ? stopSimulation : startSimulation}
            style={btnStyle(isRunning ? '#ff6b6b' : '#00e5a0')}
          >
            {isRunning ? '⏸ STOP' : '▶ START'}
          </button>
          <button onClick={resetSimulation} style={btnStyle('#555')}>
            ↺ RESET
          </button>
        </div>

        {/* Speed selector */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => handleConfigChange('simulationSpeed', s)}
              style={{
                ...smallBtnStyle,
                background: config.simulationSpeed === s ? '#1e1e3a' : '#0a0a12',
                color: config.simulationSpeed === s ? '#a29bfe' : '#555',
                border: `1px solid ${config.simulationSpeed === s ? '#a29bfe' : '#1e1e2e'}`,
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </Section>

      {/* Simulation parameters */}
      <Section title="PARAMETERS">
        <Slider
          label="Elevators"
          value={config.numElevators}
          min={1} max={6}
          onChange={(v) => handleConfigChange('numElevators', v)}
          disabled={isRunning}
        />
        <Slider
          label="Floors"
          value={config.numFloors}
          min={4} max={20}
          onChange={(v) => handleConfigChange('numFloors', v)}
          disabled={isRunning}
        />
        <Slider
          label="Capacity"
          value={config.elevatorCapacity}
          min={4} max={16}
          onChange={(v) => handleConfigChange('elevatorCapacity', v)}
          disabled={isRunning}
        />
        <Slider
          label="Req/tick"
          value={config.requestFrequency}
          min={0.1} max={8} step={0.1}
          onChange={(v) => handleConfigChange('requestFrequency', parseFloat(v.toFixed(1)))}
          format={(v) => v.toFixed(1)}
        />
      </Section>

      {/* Scenario selector */}
      <Section title="SCENARIO">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => setScenario(s.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: scenario === s.value ? `${s.color}15` : '#0a0a12',
                border: `1px solid ${scenario === s.value ? s.color : '#1e1e2e'}`,
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: s.color,
                boxShadow: scenario === s.value ? `0 0 6px ${s.color}` : 'none',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 11, color: scenario === s.value ? s.color : '#666', fontFamily: 'monospace', fontWeight: 700 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Manual request */}
      <Section title="MANUAL REQUEST">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>From</label>
            <select
              value={manualOrigin}
              onChange={(e) => setManualOrigin(Number(e.target.value))}
              style={selectStyle}
            >
              {Array.from({ length: numFloors }, (_, i) => i + 1).map((f) => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
            </select>
          </div>
          <div style={{ color: '#444', paddingTop: 16 }}>→</div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>To</label>
            <select
              value={manualDest}
              onChange={(e) => setManualDest(Number(e.target.value))}
              style={selectStyle}
            >
              {Array.from({ length: numFloors }, (_, i) => i + 1).map((f) => (
                <option key={f} value={f}>Floor {f}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleManualRequest}
          disabled={manualOrigin === manualDest}
          style={{
            ...btnStyle('#a29bfe'),
            marginTop: 8,
            opacity: manualOrigin === manualDest ? 0.4 : 1,
          }}
        >
          + ADD REQUEST
        </button>
      </Section>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{
      fontSize: 9,
      fontFamily: 'monospace',
      color: '#333',
      letterSpacing: 3,
      marginBottom: 10,
      textTransform: 'uppercase',
      borderBottom: '1px solid #111',
      paddingBottom: 6,
    }}>
      {title}
    </div>
    {children}
  </div>
);

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  format?: (v: number) => string;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, disabled, format }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <label style={labelStyle}>{label}</label>
      <span style={{ ...labelStyle, color: '#a29bfe' }}>{format ? format(value) : value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: '#a29bfe', opacity: disabled ? 0.4 : 1 }}
    />
  </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const btnStyle = (color: string): React.CSSProperties => ({
  flex: 1,
  padding: '8px 0',
  background: `${color}18`,
  border: `1px solid ${color}55`,
  borderRadius: 6,
  color,
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
  fontWeight: 700,
  transition: 'all 0.15s',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'monospace',
  color: '#555',
  letterSpacing: 1,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0a12',
  border: '1px solid #1e1e2e',
  borderRadius: 4,
  color: '#aaa',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '4px 6px',
  marginTop: 2,
};
