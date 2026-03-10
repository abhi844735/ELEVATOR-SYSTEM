/**
 * ─────────────────────────────────────────────────────────────────
 *  SimulationEngine — Tick-based state machine
 * ─────────────────────────────────────────────────────────────────
 *
 *  Each tick:
 *  1. Age request priorities & detect starvation
 *  2. Generate new requests (based on frequency config)
 *  3. Assign unassigned requests via Scheduler
 *  4. Advance each elevator one step (state machine):
 *       IDLE       → stay / pre-position
 *       MOVING     → move one floor toward next target
 *                    → arrive: open doors (DOOR_OPEN)
 *       DOOR_OPEN  → pick up / drop off passengers
 *                    → close doors → update direction
 *  5. Recompute metrics
 *  6. Emit state to WebSocket clients
 * ─────────────────────────────────────────────────────────────────
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SimulationState,
  SimulationConfig,
  ElevatorCar,
  PassengerRequest,
  SimulationMetrics,
  ScenarioType,
} from '../types';
import { Scheduler, DOOR_OPEN_TICKS } from './Scheduler';

// ─── Door state tracking (per elevator, not in ElevatorCar to keep it clean) ─
type DoorTimer = Record<string, number>; // elevatorId → ticks remaining with door open

export type StateCallback = (state: SimulationState) => void;

export class SimulationEngine {
  private state: SimulationState;
  private scheduler: Scheduler;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onStateUpdate: StateCallback;
  private doorTimers: DoorTimer = {};
  private sessionId: string;
  private requestAccumulator = 0; // For fractional request rates

  constructor(onStateUpdate: StateCallback) {
    this.onStateUpdate = onStateUpdate;
    this.sessionId = uuidv4();
    this.state = this.buildInitialState();
    this.scheduler = new Scheduler(this.state.config, this.state.scenario);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    const intervalMs = Math.round(this.state.config.tickIntervalMs / this.state.config.simulationSpeed);
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    this.emit();
  }

  stop(): void {
    if (!this.state.isRunning) return;
    this.state.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emit();
  }

  reset(): void {
    this.stop();
    const config = { ...this.state.config };
    const scenario = this.state.scenario;
    this.doorTimers = {};
    this.requestAccumulator = 0;
    this.state = this.buildInitialState(config, scenario);
    this.scheduler = new Scheduler(config, scenario);
    this.emit();
  }

  updateConfig(config: Partial<SimulationConfig>): void {
    const wasRunning = this.state.isRunning;
    if (wasRunning) this.stop();

    this.state.config = { ...this.state.config, ...config };

    // Rebuild elevators if count changed
    if (config.numElevators !== undefined) {
      this.rebuildElevators();
    }

    this.scheduler.updateConfig(this.state.config, this.state.scenario);

    if (wasRunning) this.start();
    else this.emit();
  }

  setScenario(scenario: ScenarioType): void {
    this.state.scenario = scenario;

    // Auto-configure peak settings based on scenario
    const isPeakHour = scenario === 'MORNING_RUSH' || scenario === 'EVENING_RUSH' || scenario === 'LUNCH_PEAK';
    const peakBias = scenario === 'MORNING_RUSH' ? 0.7 : scenario === 'EVENING_RUSH' ? 0.65 : 0.4;
    const frequency = scenario === 'STRESS_TEST' ? 5 : isPeakHour ? 2 : 0.8;

    this.state.config = {
      ...this.state.config,
      isPeakHour,
      peakHourLobbyBias: peakBias,
      requestFrequency: frequency,
    };

    this.scheduler.updateConfig(this.state.config, scenario);
    this.emit();
  }

  addManualRequest(originFloor: number, destinationFloor: number): void {
    const req: PassengerRequest = {
      id: uuidv4(),
      originFloor,
      destinationFloor,
      requestedAt: this.state.tick,
      status: 'PENDING',
      priority: 50, // Medium-high priority for manual requests
      type: 'EXTERNAL',
      isPeakHour: this.state.config.isPeakHour,
      isStarved: false,
    };
    this.state.pendingRequests.push(req);
    this.emit();
  }

  getState(): SimulationState {
    return this.state;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ─── Core Tick ────────────────────────────────────────────────────────────

  private tick(): void {
    this.state.tick++;
    const { tick, config, elevators } = this.state;

    // 1. Age priorities & detect starvation
    this.scheduler.agePriorities(this.state.pendingRequests, tick);

    // 2. Generate new requests
    this.generateRequests();

    // 3. Assign unassigned pending requests to elevators
    this.scheduler.assignRequests(this.state.pendingRequests, elevators, tick);

    // 4. Advance each elevator's state machine
    for (const elevator of elevators) {
      this.advanceElevator(elevator);
    }

    // 5. Pre-position idle elevators (every 10 ticks to avoid jitter)
    if (tick % 10 === 0) {
      this.scheduler.prePositionIdle(elevators);
    }

    // 6. Recompute metrics
    this.state.metrics = this.computeMetrics();

    // 7. Emit
    this.emit();
  }

  // ─── Request Generation ───────────────────────────────────────────────────

  private generateRequests(): void {
    this.requestAccumulator += this.state.config.requestFrequency;
    const toGenerate = Math.floor(this.requestAccumulator);
    this.requestAccumulator -= toGenerate;

    for (let i = 0; i < toGenerate; i++) {
      const req = this.scheduler.generateRequest(this.state.tick);
      this.state.pendingRequests.push(req);
    }
  }

  // ─── Elevator State Machine ───────────────────────────────────────────────

  private advanceElevator(elevator: ElevatorCar): void {
    const { tick } = this.state;

    // ── DOOR_OPEN phase ──────────────────────────────────────────────────────
    if (elevator.doorState === 'OPEN' || elevator.doorState === 'OPENING') {
      const remaining = (this.doorTimers[elevator.id] ?? DOOR_OPEN_TICKS) - 1;
      this.doorTimers[elevator.id] = remaining;

      if (remaining <= 0) {
        // Door closing phase
        elevator.doorState = 'CLOSING';
        elevator.status = elevator.targetFloors.length > 0 ? 'MOVING' : 'IDLE';
        this.doorTimers[elevator.id] = 0;
      } else {
        elevator.doorState = 'OPEN';
        elevator.status = 'DOOR_OPEN';
      }

      // Pick up / drop off passengers at this floor
      this.processFloorArrivals(elevator, tick);
      elevator.utilizationTime++;
      return;
    }

    if (elevator.doorState === 'CLOSING') {
      elevator.doorState = 'CLOSED';
    }

    // ── No targets → IDLE ────────────────────────────────────────────────────
    if (elevator.targetFloors.length === 0) {
      elevator.direction = 'IDLE';
      elevator.status = 'IDLE';
      elevator.idleTime++;
      return;
    }

    // ── Move one floor toward next target ────────────────────────────────────
    const nextTarget = elevator.targetFloors[0];

    if (nextTarget === elevator.currentFloor) {
      // Arrived at target floor
      elevator.targetFloors.shift();
      elevator.doorState = 'OPENING';
      elevator.status = 'DOOR_OPEN';
      this.doorTimers[elevator.id] = DOOR_OPEN_TICKS;
      elevator.totalFloorsServiced++;
      elevator.utilizationTime++;
    } else if (nextTarget > elevator.currentFloor) {
      elevator.currentFloor++;
      elevator.direction = 'UP';
      elevator.status = 'MOVING';
      elevator.utilizationTime++;
    } else {
      elevator.currentFloor--;
      elevator.direction = 'DOWN';
      elevator.status = 'MOVING';
      elevator.utilizationTime++;
    }
  }

  // ─── Pick Up / Drop Off ───────────────────────────────────────────────────

  private processFloorArrivals(elevator: ElevatorCar, tick: number): void {
    const floor = elevator.currentFloor;

    // Drop off passengers whose destination is this floor
    const dropOff = elevator.passengers.filter((p) => p.destinationFloor === floor);
    for (const passenger of dropOff) {
      passenger.status = 'COMPLETED';
      passenger.completedAt = tick;
      passenger.travelTime = tick - (passenger.pickedUpAt ?? tick);
      elevator.totalPassengersServed++;
      this.state.completedRequests.push(passenger);
    }
    elevator.passengers = elevator.passengers.filter((p) => p.destinationFloor !== floor);

    // Pick up passengers waiting at this floor
    const waiting = this.state.pendingRequests.filter(
      (r) =>
        (r.status === 'ASSIGNED' || r.status === 'PENDING') &&
        r.originFloor === floor &&
        r.elevatorId === elevator.id &&
        elevator.passengers.length < elevator.capacity
    );

    for (const req of waiting) {
      req.status = 'PICKED_UP';
      req.pickedUpAt = tick;
      req.waitTime = tick - req.requestedAt;

      // Add destination floor to elevator queue
      this.scheduler.insertFloorIntoQueue(elevator, req.destinationFloor);

      // Remove from assignedRequests, add to passengers
      elevator.assignedRequests = elevator.assignedRequests.filter((id) => id !== req.id);
      elevator.passengers.push(req);
    }

    // Remove picked-up requests from pending list
    const pickedUpIds = new Set(waiting.map((r) => r.id));
    this.state.pendingRequests = this.state.pendingRequests.filter(
      (r) => !pickedUpIds.has(r.id)
    );
  }

  // ─── Metrics ─────────────────────────────────────────────────────────────

  private computeMetrics(): SimulationMetrics {
    const completed = this.state.completedRequests;
    const pending = this.state.pendingRequests;
    const { tick } = this.state;

    const waitTimes = completed.filter((r) => r.waitTime != null).map((r) => r.waitTime!);
    const travelTimes = completed.filter((r) => r.travelTime != null).map((r) => r.travelTime!);

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

    const totalTicks = tick || 1;
    const elevatorUtilization = this.state.elevators.map((e) =>
      Math.round((e.utilizationTime / totalTicks) * 100)
    );

    const throughput = tick > 0 ? (completed.length / tick) * 100 : 0;
    const starved = [...completed, ...pending].filter((r) => r.isStarved).length;

    return {
      avgWaitTime: Math.round(avg(waitTimes) * 10) / 10,
      maxWaitTime: max(waitTimes),
      avgTravelTime: Math.round(avg(travelTimes) * 10) / 10,
      maxTravelTime: max(travelTimes),
      totalRequestsServed: completed.length,
      totalRequestsPending: pending.length,
      elevatorUtilization,
      throughput: Math.round(throughput * 10) / 10,
      starvedRequests: starved,
      peakWaitTime: max(waitTimes),
    };
  }

  // ─── Factory / Helpers ────────────────────────────────────────────────────

  private buildInitialState(
    config?: SimulationConfig,
    scenario: ScenarioType = 'NORMAL'
  ): SimulationState {
    const defaultConfig: SimulationConfig = config ?? {
      numElevators: 3,
      numFloors: 10,
      elevatorCapacity: 8,
      tickIntervalMs: 800,
      requestFrequency: 0.8,
      simulationSpeed: 1,
      isPeakHour: false,
      peakHourLobbyBias: 0.7,
    };

    return {
      isRunning: false,
      tick: 0,
      elevators: this.createElevators(defaultConfig.numElevators, defaultConfig),
      pendingRequests: [],
      completedRequests: [],
      config: defaultConfig,
      metrics: this.emptyMetrics(defaultConfig.numElevators),
      scenario,
    };
  }

  private createElevators(count: number, config: SimulationConfig): ElevatorCar[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `elevator-${i + 1}`,
      currentFloor: 1,
      targetFloors: [],
      direction: 'IDLE' as const,
      doorState: 'CLOSED' as const,
      status: 'IDLE' as const,
      passengers: [],
      capacity: config.elevatorCapacity,
      assignedRequests: [],
      totalFloorsServiced: 0,
      totalPassengersServed: 0,
      utilizationTime: 0,
      idleTime: 0,
    }));
  }

  private rebuildElevators(): void {
    const { numElevators, config } = this.state as { numElevators?: number; config: SimulationConfig };
    this.state.elevators = this.createElevators(this.state.config.numElevators, this.state.config);
    this.state.pendingRequests = [];
    this.state.completedRequests = [];
    this.doorTimers = {};
  }

  private emptyMetrics(numElevators: number): SimulationMetrics {
    return {
      avgWaitTime: 0,
      maxWaitTime: 0,
      avgTravelTime: 0,
      maxTravelTime: 0,
      totalRequestsServed: 0,
      totalRequestsPending: 0,
      elevatorUtilization: new Array(numElevators).fill(0),
      throughput: 0,
      starvedRequests: 0,
      peakWaitTime: 0,
    };
  }

  private emit(): void {
    this.onStateUpdate(this.state);
  }
}
