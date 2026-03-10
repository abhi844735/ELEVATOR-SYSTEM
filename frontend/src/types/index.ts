export type ElevatorDirection = 'UP' | 'DOWN' | 'IDLE';
export type ElevatorDoorState = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING';
export type ElevatorStatus = 'MOVING' | 'IDLE' | 'DOOR_OPEN' | 'MAINTENANCE';
export type RequestStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'COMPLETED' | 'EXPIRED';
export type ScenarioType = 'NORMAL' | 'MORNING_RUSH' | 'EVENING_RUSH' | 'LUNCH_PEAK' | 'STRESS_TEST';

export interface PassengerRequest {
  id: string;
  originFloor: number;
  destinationFloor: number;
  requestedAt: number;
  assignedAt?: number;
  pickedUpAt?: number;
  completedAt?: number;
  status: RequestStatus;
  priority: number;
  type: 'EXTERNAL' | 'INTERNAL';
  elevatorId?: string;
  waitTime?: number;
  travelTime?: number;
  isPeakHour?: boolean;
  isStarved?: boolean;
}

export interface ElevatorCar {
  id: string;
  currentFloor: number;
  targetFloors: number[];
  direction: ElevatorDirection;
  doorState: ElevatorDoorState;
  status: ElevatorStatus;
  passengers: PassengerRequest[];
  capacity: number;
  assignedRequests: string[];
  totalFloorsServiced: number;
  totalPassengersServed: number;
  utilizationTime: number;
  idleTime: number;
}

export interface SimulationConfig {
  numElevators: number;
  numFloors: number;
  elevatorCapacity: number;
  tickIntervalMs: number;
  requestFrequency: number;
  simulationSpeed: number;
  isPeakHour: boolean;
  peakHourLobbyBias: number;
}

export interface SimulationMetrics {
  avgWaitTime: number;
  maxWaitTime: number;
  avgTravelTime: number;
  maxTravelTime: number;
  totalRequestsServed: number;
  totalRequestsPending: number;
  elevatorUtilization: number[];
  throughput: number;
  starvedRequests: number;
  peakWaitTime: number;
}

export interface SimulationState {
  isRunning: boolean;
  tick: number;
  elevators: ElevatorCar[];
  pendingRequests: PassengerRequest[];
  completedRequests: PassengerRequest[];
  config: SimulationConfig;
  metrics: SimulationMetrics;
  scenario: ScenarioType;
}

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
