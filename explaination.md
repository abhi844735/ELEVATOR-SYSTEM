# Elevator System — Use Cases, Requirements, Solution & Output Explained

---

## 🏢 What is this project actually?

Imagine you're the **brain of an elevator system** in a building. Your job is to decide:
- Which elevator should go pick up a person waiting on Floor 5?
- What if 3 people are waiting on different floors at the same time?
- What if it's 9 AM and everyone is rushing from the lobby?

That's exactly what this project simulates and solves.

---

## 📋 Use Cases (Real-world situations it handles)

### Use Case 1 — Normal Day
> Someone on Floor 7 wants to go to Floor 2.

The system finds the **nearest available elevator**, sends it to Floor 7, picks the person up, drops them at Floor 2.

### Use Case 2 — Morning Rush (9 AM)
> 10 people are all waiting at the lobby (Floor 1) wanting to go UP to their offices.

The system **knows it's peak hour**, so it keeps more elevators near the lobby and gives lobby requests higher priority.

### Use Case 3 — Someone waiting too long
> A person on Floor 9 has been waiting for 60 seconds and no elevator came.

The system detects **starvation**, boosts that request to maximum priority, and forces the nearest elevator to go there immediately.

### Use Case 4 — Elevator is full
> Elevator 2 already has 8 people inside (max capacity).

The system **skips that elevator** and assigns the next waiting person to Elevator 1 or 3 instead.

### Use Case 5 — Stress Test
> 100+ people request elevators at the same time.

The system handles all requests in a queue, sorted by priority, so no one is ignored.

---

## ✅ Requirements — What the assignment asked

| Requirement | In Plain English |
|---|---|
| Visual simulation of n elevators, k floors | Show animated elevators moving up/down on screen |
| Real-time positions, directions, door states | Show ↑ ↓ or idle, show doors opening/closing |
| Passenger counts | Show how many people are inside each elevator |
| Floor buttons (up/down calls) | Green/red dots showing someone is waiting on a floor |
| Controls: elevators, floors, speed | Sliders to change the building size and simulation speed |
| Start / Stop / Reset | Play/pause buttons |
| Random request generation | Auto-generate passengers waiting on random floors |
| Peak traffic (70% from lobby at 9 AM) | Morning Rush scenario floods lobby with requests |
| Minimize wait time | Person should be picked up quickly |
| Minimize travel time | After picked up, reach destination fast |
| No starvation | Nobody waits forever |
| Balance elevators | Don't send all 3 elevators to same floor |

---

## 🧠 Solution — How the algorithm works (super simple)

Think of it like a **taxi dispatch center**:

### Step 1 — Someone calls an elevator
A request is created: *"Person on Floor 5 wants to go to Floor 8"*

### Step 2 — Pick the best elevator
We score every elevator using a simple formula:

```
Score = Distance from elevator to person
      + Penalty if elevator is going the wrong way
      + Penalty if elevator is already crowded
```

**Lowest score wins** → that elevator gets assigned.

### Step 3 — Elevator follows LOOK pattern
The elevator doesn't randomly jump around. It works like a **scanner**:
- Going UP → stops at every floor with a waiting person on the way up
- Reaches the top → turns around and goes DOWN
- Stops at every floor with a person on the way down
- This is called the **LOOK algorithm** (same idea as how a hard disk read head moves)

### Step 4 — Priority aging (anti-starvation)
Every 30 seconds of waiting → priority goes up by 10 points.
After 60 seconds → priority becomes 100 (maximum) and elevator is **forced** to go there.

### Step 5 — Peak hour logic
If it's Morning Rush scenario → 70% of generated passengers start from Floor 1 (lobby) and the algorithm pre-positions idle elevators near the lobby.

---

## 🖥️ Output — What you see on screen

```
┌─────────────────────────────────────────────────────┐
│  LEFT PANEL          CENTRE            RIGHT PANEL  │
│                                                     │
│  [▶ START]     Floor 10  |  |  |      AVG WAIT: 4t │
│  [↺ RESET]     Floor 9   |  |  |      SERVED: 62   │
│                Floor 8   |  ↑  |      PENDING: 5   │
│  Elevators: 3  Floor 7  [E2] |  |                  │
│  Floors: 10    Floor 6   |  |  |      📊 Charts    │
│  Speed: 1×     Floor 5   | [E3] |     wait time    │
│                Floor 4   |  |  |     travel time   │
│  Scenario:     Floor 3   |  |  |     utilization   │
│  [Morning Rush]Floor 2  [E1] |  |                  │
│                Floor 1   |  |  |     REQUEST QUEUE │
│  Manual        (LOBBY)   |  |  |     P50 F1→F8 3t  │
│  Request:                              P30 F3→F1 8t  │
│  F3 → F7                               ...          │
└─────────────────────────────────────────────────────┘
```

### What each part shows:

**Left panel — Your control room**
- Start/stop the simulation
- Change number of elevators, floors, speed
- Pick a scenario (Normal, Morning Rush, Stress Test etc.)
- Manually add a custom passenger request

**Centre panel — The building**
- Each column = one elevator shaft
- The box moving up/down = the elevator car
- ↑ or ↓ shows direction, — means idle
- Small dots on floors = someone waiting (green = going up, red = going down)
- Number inside box = passengers / capacity (e.g. 3/8)

**Right panel — The data**
- KPI cards: average wait time, travel time, total served, pending count
- Live charts that update as simulation runs
- Request queue: shows all waiting people sorted by priority, color-coded by how long they've waited (yellow = aging, red = starved)

---

## 🔑 Key Terms Decoded

| Term | Simple meaning |
|---|---|
| **Tick** | One "heartbeat" of the simulation. Each tick, elevators move one floor. |
| **Wait time** | How many ticks between "person pressed button" and "elevator arrived" |
| **Travel time** | How many ticks between "person got in" and "reached their floor" |
| **Starved** | Request that waited too long and got ignored — the system fixes this automatically |
| **Utilization %** | How busy each elevator is. 80% = working hard. 20% = mostly idle. |
| **Throughput** | How many people delivered per 100 ticks — higher is better |
| **LOOK algorithm** | Elevator sweeps up then down continuously, like a broom |
| **Priority aging** | The longer you wait, the more urgent your request becomes |

---

## 🎯 What this project actually demonstrates (for the interview)

This is a live demonstration that you understand:

1. **OS Scheduling concepts** — Priority queues, starvation prevention, aging (same ideas used in CPU scheduling)
2. **Real-time systems** — WebSocket-based live state updates, tick-based simulation loop
3. **Algorithm design** — LOOK + cost function + priority aging working together
4. **User-centric thinking** — Peak hour bias, capacity limits, visual warnings
5. **Full-stack engineering** — React + TypeScript frontend, Node/Express backend, MongoDB persistence, WebSocket communication