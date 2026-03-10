// ─── Elevator Types ───────────────────────────────────────────────────────────

export type ElevatorDirection = 'UP' | 'DOWN' | 'IDLE';
export type ElevatorDoorState = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING';
export type ElevatorStatus = 'MOVING' | 'IDLE' | 'DOOR_OPEN' | 'MAINTENANCE';
export type RequestStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'COMPLETED' | 'EXPIRED';
export type RequestType = 'EXTERNAL' | 'INTERNAL';

export interface ElevatorCar {
  id: string;
  currentFloor: number;
  targetFloors: number[];       // Sorted queue of floors to visit
  direction: ElevatorDirection;
  doorState: ElevatorDoorState;
  status: ElevatorStatus;
  passengers: PassengerRequest[];
  capacity: number;             // Max passengers (default 8)
  assignedRequests: string[];   // Request IDs assigned to this elevator
  totalFloorsServiced: number;
  totalPassengersServed: number;
  utilizationTime: number;      // Ticks spent moving/serving (for utilization %)
  idleTime: number;
}

export interface PassengerRequest {
  id: string;
  originFloor: number;
  destinationFloor: number;
  requestedAt: number;          // Simulation tick when requested
  assignedAt?: number;
  pickedUpAt?: number;
  completedAt?: number;
  status: RequestStatus;
  priority: number;             // 1–100 (higher = more urgent)
  type: RequestType;
  elevatorId?: string;
  waitTime?: number;            // Ticks between request and pickup
  travelTime?: number;          // Ticks between pickup and destination
  isPeakHour?: boolean;
  isStarved?: boolean;          // True if waited > 30s equivalent
}

// ─── Simulation State ─────────────────────────────────────────────────────────

export interface SimulationConfig {
  numElevators: number;         // n
  numFloors: number;            // k
  elevatorCapacity: number;
  tickIntervalMs: number;       // Real ms per simulation tick
  requestFrequency: number;     // Requests generated per tick (avg)
  simulationSpeed: number;      // 1x, 2x, 5x
  isPeakHour: boolean;
  peakHourLobbyBias: number;    // 0–1, fraction of requests from lobby during peak
}

export interface SimulationState {
  isRunning: boolean;
  tick: number;                 // Current simulation tick
  elevators: ElevatorCar[];
  pendingRequests: PassengerRequest[];
  completedRequests: PassengerRequest[];
  config: SimulationConfig;
  metrics: SimulationMetrics;
  scenario: ScenarioType;
}

export type ScenarioType = 'NORMAL' | 'MORNING_RUSH' | 'EVENING_RUSH' | 'LUNCH_PEAK' | 'STRESS_TEST';

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface SimulationMetrics {
  avgWaitTime: number;          // Average ticks between request and pickup
  maxWaitTime: number;
  avgTravelTime: number;        // Average ticks between pickup and destination
  maxTravelTime: number;
  totalRequestsServed: number;
  totalRequestsPending: number;
  elevatorUtilization: number[];  // Per-elevator utilization %
  throughput: number;           // Requests completed per 100 ticks
  starvedRequests: number;      // Requests that waited > starvation threshold
  peakWaitTime: number;
}

// ─── WebSocket Message Types ──────────────────────────────────────────────────

export type WSMessageType =
  | 'STATE_UPDATE'
  | 'CONFIG_UPDATE'
  | 'SIMULATION_START'
  | 'SIMULATION_STOP'
  | 'SIMULATION_RESET'
  | 'MANUAL_REQUEST'
  | 'SCENARIO_CHANGE'
  | 'METRICS_SNAPSHOT'
  | 'ERROR';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

export interface WSStateUpdate {
  state: SimulationState;
}

export interface WSConfigUpdate {
  config: Partial<SimulationConfig>;
}

export interface WSManualRequest {
  originFloor: number;
  destinationFloor: number;
}

// ─── Scheduler Types ─────────────────────────────────────────────────────────

export interface ElevatorScore {
  elevatorId: string;
  cost: number;
  distance: number;
  directionPenalty: number;
  loadFactor: number;
}
