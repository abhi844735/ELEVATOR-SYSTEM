import React, { useMemo } from 'react';
import { ElevatorCar, PassengerRequest } from '../types';

interface Props {
  elevator: ElevatorCar;
  numFloors: number;
  pendingRequests: PassengerRequest[];
  tick: number;
}

const FLOOR_HEIGHT_PX = 64; // px per floor
const SHAFT_WIDTH = 88;

export const ElevatorShaft: React.FC<Props> = ({ elevator, numFloors, pendingRequests, tick }) => {
  const carBottomPercent = ((elevator.currentFloor - 1) / (numFloors - 1)) * 100;

  const isOverloaded = elevator.passengers.length >= elevator.capacity;
  const loadPercent = Math.round((elevator.passengers.length / elevator.capacity) * 100);

  // Which floors have pending up/down calls?
  const floorsWithUpCall = useMemo(
    () => new Set(pendingRequests.filter((r) => r.destinationFloor > r.originFloor).map((r) => r.originFloor)),
    [pendingRequests]
  );
  const floorsWithDownCall = useMemo(
    () => new Set(pendingRequests.filter((r) => r.destinationFloor < r.originFloor).map((r) => r.originFloor)),
    [pendingRequests]
  );

  const directionColor =
    elevator.direction === 'UP'
      ? '#00e5a0'
      : elevator.direction === 'DOWN'
      ? '#ff6b6b'
      : '#888';

  const statusGlow =
    elevator.doorState === 'OPEN' || elevator.doorState === 'OPENING'
      ? '0 0 20px rgba(0,229,160,0.6)'
      : elevator.status === 'MOVING'
      ? `0 0 12px ${directionColor}44`
      : 'none';

  const elevatorLabel = elevator.id.replace('elevator-', 'E');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Elevator ID Label */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#888',
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        {elevatorLabel}
      </div>

      {/* Shaft wrapper */}
      <div style={{
        position: 'relative',
        width: SHAFT_WIDTH,
        height: numFloors * FLOOR_HEIGHT_PX,
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0e0e18 100%)',
        border: '1px solid #1e1e2e',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Floor markers */}
        {Array.from({ length: numFloors }, (_, i) => {
          const floor = numFloors - i; // top floor first
          const hasUp = floorsWithUpCall.has(floor);
          const hasDown = floorsWithDownCall.has(floor);
          const isTarget = elevator.targetFloors.includes(floor);

          return (
            <div
              key={floor}
              style={{
                position: 'absolute',
                top: i * FLOOR_HEIGHT_PX,
                left: 0,
                right: 0,
                height: FLOOR_HEIGHT_PX,
                borderBottom: '1px solid #1a1a2a',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 6,
                gap: 4,
              }}
            >
              {/* Floor number */}
              <span style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: isTarget ? '#fff' : '#333',
                fontWeight: isTarget ? 700 : 400,
                minWidth: 18,
              }}>
                {floor}
              </span>

              {/* Floor line */}
              <div style={{
                flex: 1,
                height: 1,
                background: isTarget ? '#3a3a5a' : '#1a1a2a',
              }} />

              {/* Call indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingRight: 4 }}>
                {hasUp && (
                  <div style={{
                    width: 6,
                    height: 6,
                    background: '#00e5a0',
                    borderRadius: '50%',
                    boxShadow: '0 0 4px #00e5a0',
                  }} />
                )}
                {hasDown && (
                  <div style={{
                    width: 6,
                    height: 6,
                    background: '#ff6b6b',
                    borderRadius: '50%',
                    boxShadow: '0 0 4px #ff6b6b',
                  }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Elevator Car */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: `${carBottomPercent}%`,
            width: 52,
            height: FLOOR_HEIGHT_PX - 8,
            marginBottom: 4,
            transition: 'bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: 4,
            background: isOverloaded
              ? 'linear-gradient(135deg, #3d1010 0%, #5a1818 100%)'
              : 'linear-gradient(135deg, #0d1b2a 0%, #1a2a3a 100%)',
            border: `2px solid ${directionColor}55`,
            boxShadow: statusGlow,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            overflow: 'hidden',
          }}
        >
          {/* Door animation */}
          {(elevator.doorState === 'OPEN' || elevator.doorState === 'OPENING') && (
            <>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '100%',
                background: 'rgba(0,229,160,0.08)',
                borderRight: '1px solid rgba(0,229,160,0.3)',
                animation: 'doorSlideLeft 0.2s ease-out forwards',
              }} />
              <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                background: 'rgba(0,229,160,0.08)',
                borderLeft: '1px solid rgba(0,229,160,0.3)',
                animation: 'doorSlideRight 0.2s ease-out forwards',
              }} />
            </>
          )}

          {/* Direction arrow */}
          <div style={{
            fontSize: 14,
            color: directionColor,
            lineHeight: 1,
            textShadow: `0 0 8px ${directionColor}`,
          }}>
            {elevator.direction === 'UP' ? '↑' : elevator.direction === 'DOWN' ? '↓' : '—'}
          </div>

          {/* Passenger count */}
          <div style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: isOverloaded ? '#ff6b6b' : '#aaa',
            fontWeight: 700,
          }}>
            {elevator.passengers.length}/{elevator.capacity}
          </div>

          {/* Load bar */}
          <div style={{
            position: 'absolute',
            bottom: 2,
            left: 4,
            right: 4,
            height: 2,
            background: '#1a1a2a',
            borderRadius: 1,
          }}>
            <div style={{
              height: '100%',
              width: `${loadPercent}%`,
              background: isOverloaded ? '#ff6b6b' : loadPercent > 60 ? '#ffd166' : '#00e5a0',
              borderRadius: 1,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Target floors display */}
      <div style={{
        fontFamily: 'monospace',
        fontSize: 9,
        color: '#444',
        textAlign: 'center',
        maxWidth: SHAFT_WIDTH,
        wordBreak: 'break-all',
      }}>
        {elevator.targetFloors.slice(0, 6).join(' → ') || '—'}
      </div>

      {/* Status badge */}
      <div style={{
        fontSize: 9,
        fontFamily: 'monospace',
        color:
          elevator.status === 'MOVING' ? directionColor :
          elevator.status === 'DOOR_OPEN' ? '#ffd166' :
          '#444',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}>
        {elevator.status}
      </div>
    </div>
  );
};
