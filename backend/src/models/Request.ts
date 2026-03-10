import mongoose, { Schema, Document } from 'mongoose';
import { PassengerRequest, RequestStatus, RequestType } from '../types';

export interface IRequestDocument extends PassengerRequest, Document {}

const RequestSchema = new Schema<IRequestDocument>(
  {
    id: { type: String, required: true, unique: true },
    originFloor: { type: Number, required: true },
    destinationFloor: { type: Number, required: true },
    requestedAt: { type: Number, required: true },
    assignedAt: { type: Number },
    pickedUpAt: { type: Number },
    completedAt: { type: Number },
    status: {
      type: String,
      enum: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'COMPLETED', 'EXPIRED'] as RequestStatus[],
      default: 'PENDING',
    },
    priority: { type: Number, default: 1 },
    type: {
      type: String,
      enum: ['EXTERNAL', 'INTERNAL'] as RequestType[],
      default: 'EXTERNAL',
    },
    elevatorId: { type: String },
    waitTime: { type: Number },
    travelTime: { type: Number },
    isPeakHour: { type: Boolean, default: false },
    isStarved: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'requests',
  }
);

RequestSchema.index({ status: 1 });
RequestSchema.index({ requestedAt: 1 });
RequestSchema.index({ elevatorId: 1 });

export const RequestModel = mongoose.model<IRequestDocument>('Request', RequestSchema);
