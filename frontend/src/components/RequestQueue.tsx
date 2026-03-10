import React from 'react';
import { PassengerRequest } from '../types';

interface Props {
  pendingRequests: PassengerRequest[];
  tick: number;
  numFloors: number;
}

const MAX_VISIBLE = 12;

export const RequestQueue: React.FC<Props> = ({ pendingRequests, tick, numFloors }) => {
  const sorted = [...pendingRequests]
    .sort((a, b) => b.priority - a.priority || a.requestedAt - b.requestedAt)
    .slice(0, MAX_VISIBLE);

  return (
    <div>
      <div style={{
        fontSize: 9,
        fontFamily: 'monospace',
        color: '#333',
        letterSpacing: 3,
        marginBottom: 10,
        borderBottom: '1px solid #111',
        paddingBottom: 6,
      }}>
        REQUEST QUEUE ({pendingRequests.length})
      </div>

      {sorted.length === 0 ? (
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#2a2a3a', textAlign: 'center', padding: '20px 0' }}>
          No pending requests
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.map((req) => {
            const waited = tick - req.requestedAt;
            const isStarved = req.isStarved;
            const dirColor = req.destinationFloor > req.originFloor ? '#00e5a0' : '#ff6b6b';

            return (
              <div
                key={req.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 40px 36px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: isStarved ? '#2a0a0a' : '#0a0a12',
                  border: `1px solid ${isStarved ? '#ff6b6b33' : '#1a1a2a'}`,
                  borderRadius: 5,
                  borderLeft: `3px solid ${isStarved ? '#ff6b6b' : req.isPeakHour ? '#ffd166' : dirColor}`,
                }}
              >
                {/* Priority badge */}
                <div style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: isStarved ? '#ff6b6b' : '#555',
                  fontWeight: 700,
                  textAlign: 'center',
                }}>
                  P{req.priority}
                </div>

                {/* Route */}
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#888' }}>
                  <span style={{ color: '#aaa' }}>F{req.originFloor}</span>
                  <span style={{ color: dirColor, margin: '0 4px' }}>
                    {req.destinationFloor > req.originFloor ? '↑' : '↓'}
                  </span>
                  <span style={{ color: '#aaa' }}>F{req.destinationFloor}</span>
                </div>

                {/* Status */}
                <div style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  color:
                    req.status === 'ASSIGNED' ? '#a29bfe' :
                    req.status === 'PICKED_UP' ? '#00e5a0' :
                    '#555',
                  textAlign: 'right',
                }}>
                  {req.status === 'ASSIGNED' ? `E${req.elevatorId?.replace('elevator-', '')}` : req.status.slice(0, 4)}
                </div>

                {/* Wait time */}
                <div style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: waited > 60 ? '#ff6b6b' : waited > 30 ? '#ffd166' : '#444',
                  textAlign: 'right',
                }}>
                  {waited}t
                </div>
              </div>
            );
          })}

          {pendingRequests.length > MAX_VISIBLE && (
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#333', textAlign: 'center', padding: '4px 0' }}>
              +{pendingRequests.length - MAX_VISIBLE} more…
            </div>
          )}
        </div>
      )}
    </div>
  );
};
