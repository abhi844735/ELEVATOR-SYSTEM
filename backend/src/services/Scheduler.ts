/**
 * ─────────────────────────────────────────────────────────────────
 *  ADAPTIVE-LOOK Scheduler with Priority Aging
 * ─────────────────────────────────────────────────────────────────
 *
 *  Algorithm: Modified LOOK + Priority Queue + Anti-Starvation
 *
 *  Key ideas:
 *  1. LOOK traversal  – elevator moves in one direction, serves all
 *     stops along the way, then reverses only if more requests exist.
 *  2. Cost-based assignment – each new request is assigned to the
 *     elevator with the LOWEST cost:
 *       cost = distance × 1.0 + directionPenalty × 1.5 + loadFactor × 0.5
 *  3. Priority aging   – every 30 ticks of waiting adds +10 to priority
 *  4. Peak-hour bias   – lobby→upper requests get +20 during peak hours
 *  5. Anti-starvation  – starved requests (>60 ticks pending) are force-
 *     assigned to the least-loaded idle/nearby elevator
 *  6. Pre-positioning  – idle elevators spread to lobby, mid, top floors
 * ─────────────────────────────────────────────────────────────────
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ElevatorCar,
  PassengerRequest,
  SimulationConfig,
  ElevatorDirection,
  ElevatorScore,
  ScenarioType,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const STARVATION_TICKS = 60;         // Ticks before request is considered starved
const PRIORITY_AGING_INTERVAL = 30;  // Aging bonus applied every N ticks
const PRIORITY_AGING_BONUS = 10;     // Bonus added per aging interval
const PEAK_HOUR_BONUS = 20;          // Priority bonus for lobby requests during peak
const DIRECTION_SAME_BONUS = 0;      // No penalty – elevator already going our way
const DIRECTION_OPPOSITE_PENALTY = 3; // Must finish current run first
const DOOR_OPEN_TICKS = 3;           // Ticks doors remain open

export class Scheduler {
  private config: SimulationConfig;
  private scenario: ScenarioType;

  constructor(config: SimulationConfig, scenario: ScenarioType) {
    this.config = config;
    this.scenario = scenario;
  }

  updateConfig(config: SimulationConfig, scenario: ScenarioType): void {
    this.config = config;
    this.scenario = scenario;
  }

  // ─── 1. Generate a new passenger request ──────────────────────────────────

  generateRequest(tick: number): PassengerRequest {
    const { numFloors, isPeakHour, peakHourLobbyBias } = this.config;
    const isStressTest = this.scenario === 'STRESS_TEST';

    let originFloor: number;
    let destinationFloor: number;

    const rand = Math.random();

    if (isPeakHour && rand < peakHourLobbyBias) {
      // Morning rush: most trips from lobby (floor 1) going up
      originFloor = 1;
      destinationFloor = this.randomFloor(2, numFloors);
    } else if (this.scenario === 'EVENING_RUSH' && rand < 0.7) {
      // Evening rush: people going back down to lobby
      originFloor = this.randomFloor(2, numFloors);
      destinationFloor = 1;
    } else if (this.scenario === 'LUNCH_PEAK' && rand < 0.5) {
      // Lunch: mid-floor activity
      const midpoint = Math.floor(numFloors / 2);
      originFloor = this.randomFloor(midpoint - 2, midpoint + 2);
      destinationFloor = rand < 0.25 ? 1 : this.randomFloor(1, numFloors);
    } else {
      // Normal random traffic
      originFloor = this.randomFloor(1, numFloors);
      do {
        destinationFloor = this.randomFloor(1, numFloors);
      } while (destinationFloor === originFloor);
    }

    const isPeak = isPeakHour && originFloor === 1;
    const basePriority = isStressTest ? 5 : 1;

    return {
      id: uuidv4(),
      originFloor,
      destinationFloor,
      requestedAt: tick,
      status: 'PENDING',
      priority: basePriority + (isPeak ? PEAK_HOUR_BONUS : 0),
      type: 'EXTERNAL',
      isPeakHour: isPeak,
      isStarved: false,
    };
  }

  // ─── 2. Age priorities & detect starvation ────────────────────────────────

  agePriorities(requests: PassengerRequest[], currentTick: number): void {
    for (const req of requests) {
      if (req.status !== 'PENDING' && req.status !== 'ASSIGNED') continue;

      const waitedTicks = currentTick - req.requestedAt;

      // Aging: boost priority every N ticks
      const agingSteps = Math.floor(waitedTicks / PRIORITY_AGING_INTERVAL);
      req.priority = Math.min(100, (req.isPeakHour ? PEAK_HOUR_BONUS + 1 : 1) + agingSteps * PRIORITY_AGING_BONUS);

      // Mark as starved
      if (waitedTicks >= STARVATION_TICKS && !req.isStarved) {
        req.isStarved = true;
        req.priority = 100; // Max priority
      }
    }
  }

  // ─── 3. Assign pending requests to elevators ──────────────────────────────

  assignRequests(
    pendingRequests: PassengerRequest[],
    elevators: ElevatorCar[],
    currentTick: number
  ): void {
    // Sort by priority descending, then by wait time
    const unassigned = pendingRequests
      .filter((r) => r.status === 'PENDING')
      .sort((a, b) => b.priority - a.priority || a.requestedAt - b.requestedAt);

    for (const request of unassigned) {
      const bestElevator = this.findBestElevator(request, elevators);
      if (!bestElevator) continue;

      request.status = 'ASSIGNED';
      request.assignedAt = currentTick;
      request.elevatorId = bestElevator.id;

      bestElevator.assignedRequests.push(request.id);

      // Insert the origin floor into the elevator's target queue
      this.insertFloorIntoQueue(bestElevator, request.originFloor);
    }
  }

  // ─── 4. Cost function to find best elevator ───────────────────────────────

  private findBestElevator(
    request: PassengerRequest,
    elevators: ElevatorCar[]
  ): ElevatorCar | null {
    let bestElevator: ElevatorCar | null = null;
    let lowestCost = Infinity;

    for (const elevator of elevators) {
      if (elevator.status === 'MAINTENANCE') continue;

      // Reject overloaded elevators
      if (elevator.passengers.length >= elevator.capacity) continue;

      const score = this.calculateCost(elevator, request);
      if (score.cost < lowestCost) {
        lowestCost = score.cost;
        bestElevator = elevator;
      }
    }

    return bestElevator;
  }

  calculateCost(elevator: ElevatorCar, request: PassengerRequest): ElevatorScore {
    const distance = Math.abs(elevator.currentFloor - request.originFloor);

    // Direction penalty: if elevator is moving away from request origin
    let directionPenalty = 0;
    if (elevator.direction === 'UP') {
      if (request.originFloor < elevator.currentFloor) {
        // Elevator going away – must reverse
        directionPenalty = DIRECTION_OPPOSITE_PENALTY * distance;
      }
    } else if (elevator.direction === 'DOWN') {
      if (request.originFloor > elevator.currentFloor) {
        directionPenalty = DIRECTION_OPPOSITE_PENALTY * distance;
      }
    }

    // Load factor: penalise crowded elevators (0–1 range)
    const loadFactor = elevator.passengers.length / elevator.capacity;

    const cost = distance * 1.0 + directionPenalty * 1.5 + loadFactor * this.config.numFloors * 0.5;

    return {
      elevatorId: elevator.id,
      cost,
      distance,
      directionPenalty,
      loadFactor,
    };
  }

  // ─── 5. LOOK: Insert floor into sorted queue ──────────────────────────────

  insertFloorIntoQueue(elevator: ElevatorCar, floor: number): void {
    if (elevator.targetFloors.includes(floor)) return;

    elevator.targetFloors.push(floor);

    // Re-sort using LOOK order based on current direction
    this.sortTargetFloors(elevator);
  }

  /**
   * LOOK sort: reorder targetFloors so the elevator services floors
   * in its current direction first, then reverses for remaining ones.
   */
  private sortTargetFloors(elevator: ElevatorCar): void {
    const { currentFloor, direction } = elevator;
    const floors = [...new Set(elevator.targetFloors)]; // deduplicate

    if (direction === 'UP' || direction === 'IDLE') {
      const ahead = floors.filter((f) => f >= currentFloor).sort((a, b) => a - b);
      const behind = floors.filter((f) => f < currentFloor).sort((a, b) => b - a);
      elevator.targetFloors = [...ahead, ...behind];
    } else {
      // DOWN
      const ahead = floors.filter((f) => f <= currentFloor).sort((a, b) => b - a);
      const behind = floors.filter((f) => f > currentFloor).sort((a, b) => a - b);
      elevator.targetFloors = [...ahead, ...behind];
    }
  }

  // ─── 6. Pre-position idle elevators ──────────────────────────────────────

  prePositionIdle(elevators: ElevatorCar[]): void {
    const { numFloors } = this.config;
    const idleElevators = elevators.filter(
      (e) => e.status === 'IDLE' && e.targetFloors.length === 0
    );
    if (idleElevators.length === 0) return;

    // Distribute idle elevators across strategic floors
    const strategicFloors = this.getStrategicFloors(numFloors, idleElevators.length);

    idleElevators.forEach((elevator, idx) => {
      const target = strategicFloors[idx % strategicFloors.length];
      if (target !== elevator.currentFloor) {
        elevator.targetFloors = [target];
        this.sortTargetFloors(elevator);
      }
    });
  }

  private getStrategicFloors(numFloors: number, count: number): number[] {
    if (this.config.isPeakHour || this.scenario === 'MORNING_RUSH') {
      // Bias towards lobby and lower floors
      const floors = [1];
      if (count > 1) floors.push(Math.ceil(numFloors * 0.3));
      if (count > 2) floors.push(Math.ceil(numFloors * 0.6));
      if (count > 3) floors.push(numFloors);
      return floors;
    }

    // Normal: spread evenly
    const interval = numFloors / count;
    return Array.from({ length: count }, (_, i) =>
      Math.round(1 + i * interval)
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private randomFloor(min: number, max: number): number {
    min = Math.max(1, min);
    max = Math.min(this.config.numFloors, max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

export { DOOR_OPEN_TICKS };
