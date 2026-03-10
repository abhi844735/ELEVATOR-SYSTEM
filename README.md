# ELEVATE — Elevator Dispatch Control System

A real-time, full-stack elevator simulation with an intelligent scheduling algorithm.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, TypeScript, Vite, Zustand, Recharts |
| Backend   | Node.js, Express, TypeScript, WebSocket (ws) |
| Database  | MongoDB (Mongoose)                |
| Protocol  | WebSocket (real-time), REST API   |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally on port `27017` (or update `.env`)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env    # edit MONGODB_URI if needed
npm run dev             # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev             # starts on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React Frontend                                           │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Control  │  │ ElevatorShaft│  │ MetricsDashboard │   │
│  │ Panel    │  │ (animated)   │  │ + RequestQueue   │   │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘   │
│       └───────────────┴──────────────────┘              │
│                    Zustand Store                         │
│                    WebSocket Client                      │
└───────────────────────────┬──────────────────────────────┘
                            │  ws://localhost:4000/ws
                            │  (STATE_UPDATE every tick)
┌───────────────────────────▼──────────────────────────────┐
│  Node/Express Backend                                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  SimulationEngine (tick-based state machine)     │    │
│  │  ┌────────────┐   ┌──────────────────────────┐   │    │
│  │  │ Scheduler  │   │ Elevator State Machines  │   │    │
│  │  │ (ADAPTIVE  │   │ IDLE→MOVING→DOOR_OPEN    │   │    │
│  │  │  LOOK)     │   │ →CLOSING→MOVING          │   │    │
│  │  └────────────┘   └──────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘    │
│  REST API: /api/simulation, /api/metrics                 │
│  MongoDB: metrics snapshots, request logs                │
└──────────────────────────────────────────────────────────┘
```

---

## Algorithm Design: ADAPTIVE-LOOK with Priority Aging

### Base Algorithm: LOOK
The LOOK algorithm (a variant of the elevator/SCAN algorithm used in disk scheduling):
- Each elevator moves in one direction, servicing all floors along the way
- When no more floors in current direction, reverses
- **Advantage over SCAN**: doesn't go all the way to the floor extremes unnecessarily

### Enhancement 1: Cost-Based Assignment
When a new request arrives, every elevator gets a cost score:

```
cost = distance × 1.0
     + directionPenalty × 1.5
     + loadFactor × numFloors × 0.5
```

- **distance**: Floors between elevator and origin floor
- **directionPenalty**: If elevator is moving away, it must finish before returning (penalised by `distance × 3`)
- **loadFactor**: Normalized passengers/capacity — prevents overcrowding

The request is assigned to the elevator with the **lowest cost**.

### Enhancement 2: Priority Aging (Anti-Starvation)
Requests gain priority the longer they wait:

```
priority = basePriority + floor(waitedTicks / 30) × 10
```

- After 60 ticks: request is marked "STARVED", priority set to 100 (max)
- Starved requests get immediate force-assignment to best available elevator
- **Prevents indefinite waiting** even under high load

### Enhancement 3: Peak-Hour Bias
Morning Rush scenario (8–10 AM simulation):
- 70% of requests generated from Floor 1 (lobby)
- Lobby→upper floor requests get `+20` priority bonus on creation
- Idle elevators are pre-positioned at lobby, 30th%, 60th% floors (vs. evenly spread during normal hours)

### Enhancement 4: LOOK Queue Sorting
When a new floor is inserted into an elevator's queue, it's sorted using LOOK order:
- Floors **ahead** in current direction: ascending (UP) or descending (DOWN)
- Floors **behind**: ordered for the return sweep

This ensures minimum unnecessary travel.

### Trade-offs

| Decision | Trade-off |
|----------|-----------|
| LOOK over FCFS | Reduces average wait but can delay requests in opposite direction |
| Cost function over nearest-car | Better utilization balance but slightly more CPU |
| Priority aging | Prevents starvation but briefly hurts throughput when starved requests dominate |
| Pre-positioning | Reduces wait during peaks but wastes movement when patterns are unpredictable |

---

## Scenarios

| Scenario | Config | Purpose |
|----------|--------|---------|
| NORMAL | 0.8 req/tick, random | Baseline performance |
| MORNING_RUSH | 2 req/tick, 70% from lobby ↑ | Peak-hour bias test |
| EVENING_RUSH | 2 req/tick, 65% to lobby ↓ | Reverse rush |
| LUNCH_PEAK | 1.5 req/tick, mid-floor bias | Mixed pattern |
| STRESS_TEST | 5 req/tick, all random | Throughput & starvation test |

---

## Performance Metrics (Sample — 3-Elevator, 10-Floor)

### Scenario 1: NORMAL (300 ticks)
| Metric | Value |
|--------|-------|
| Avg Wait Time | 4.2 ticks |
| Max Wait Time | 18 ticks |
| Avg Travel Time | 3.8 ticks |
| Throughput | 62 served / 100 ticks |
| Starvation | 0 |

### Scenario 2: MORNING_RUSH (300 ticks)
| Metric | Value |
|--------|-------|
| Avg Wait Time | 6.1 ticks |
| Max Wait Time | 31 ticks |
| Avg Travel Time | 5.2 ticks |
| Throughput | 48 served / 100 ticks |
| Starvation | 2 (resolved via aging) |

### Scenario 3: STRESS_TEST (300 ticks)
| Metric | Value |
|--------|-------|
| Avg Wait Time | 11.4 ticks |
| Max Wait Time | 62 ticks |
| Avg Travel Time | 7.1 ticks |
| Throughput | 95 served / 100 ticks |
| Starvation | 8 |

---

## API Reference

### REST

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/simulation/state` | Full simulation state |
| POST | `/api/simulation/start` | Start simulation |
| POST | `/api/simulation/stop` | Stop simulation |
| POST | `/api/simulation/reset` | Reset to defaults |
| PATCH | `/api/simulation/config` | Update config params |
| POST | `/api/simulation/scenario` | Switch scenario |
| POST | `/api/simulation/request` | Add manual request |
| GET | `/api/metrics/live` | Current metrics |
| GET | `/api/metrics/sessions` | Historical sessions |

### WebSocket Messages (client → server)

```ts
{ type: 'SIMULATION_START' | 'SIMULATION_STOP' | 'SIMULATION_RESET' }
{ type: 'CONFIG_UPDATE', payload: Partial<SimulationConfig> }
{ type: 'SCENARIO_CHANGE', payload: { scenario: ScenarioType } }
{ type: 'MANUAL_REQUEST', payload: { originFloor, destinationFloor } }
```

### WebSocket Messages (server → client)

```ts
{ type: 'STATE_UPDATE', payload: SimulationState }
```

---

## Bonus Features Implemented

- ✅ Elevator capacity limits with visual overload warning (red car + bar)
- ✅ Pre-positioning of idle elevators based on predicted demand
- ✅ Priority aging anti-starvation system
- ✅ 5 distinct traffic scenarios
- ✅ Manual request injection
- ✅ Historical metrics persistence in MongoDB
- ✅ Real-time charts (wait time, travel time, utilization, throughput)
- ✅ Speed control (1×, 2×, 5×)

  ---
  <img width="1915" height="936" alt="image" src="https://github.com/user-attachments/assets/09fb7280-a494-4fe6-ac8e-9c6226c79529" />
  <img width="1897" height="874" alt="image" src="https://github.com/user-attachments/assets/23d37efd-4e9e-4f87-b34f-a2f093eae132" />





