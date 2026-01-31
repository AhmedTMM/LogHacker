import mongoose, { Schema, Model } from 'mongoose';

export interface ILogEntry {
  date: Date;
  description: string;
  hobbsTime: number;
  tachTime: number;
  mechanic?: string;
  rawText?: string;
}

export interface IAircraft {
  _id: mongoose.Types.ObjectId;
  tailNumber: string;
  model: string;
  serial: string;
  manufacturer: string;
  year: number;
  imageUrl?: string;
  pohUrl?: string;
  operatingLimits?: {
    vSpeeds: {
      vso: number;
      vs1: number;
      vr: number;
      vx: number;
      vy: number;
      vfe: number;
      va: number;
      vno: number;
      vne: number;
    };
    weights: {
      maxGross: number;
      empty: number;
      usefulLoad: number;
      fuelCapacity: number;
    };
  };
  maintenanceDates: {
    annual: Date;
    transponder: Date;
    staticSystem: Date;
    hundredHour?: Date;
  };
  currentHours: {
    hobbs: number;
    tach: number;
  };
  safetyAnalysis?: {
    lastAnalyzed: Date;
    score: number;
    findings: {
      component: string;
      status: 'ok' | 'warning' | 'critical';
      message: string;
      lastMentioned?: Date;
    }[];
  };
  linkedDocuments?: mongoose.Types.ObjectId[];
  logs: ILogEntry[];
  owner?: {
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LogEntrySchema = new Schema<ILogEntry>({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  hobbsTime: { type: Number, required: true },
  tachTime: { type: Number, required: true },
  mechanic: { type: String },
  rawText: { type: String },
});

const AircraftSchema = new Schema<IAircraft>(
  {
    tailNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    serial: {
      type: String,
      required: true,
      trim: true,
    },
    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
    },
    pohUrl: {
      type: String,
    },
    operatingLimits: {
      vSpeeds: {
        vso: { type: Number },
        vs1: { type: Number },
        vr: { type: Number },
        vx: { type: Number },
        vy: { type: Number },
        vfe: { type: Number },
        va: { type: Number },
        vno: { type: Number },
        vne: { type: Number },
      },
      weights: {
        maxGross: { type: Number },
        empty: { type: Number },
        usefulLoad: { type: Number },
        fuelCapacity: { type: Number },
      },
    },
    maintenanceDates: {
      annual: { type: Date, required: true },
      transponder: { type: Date, required: true },
      staticSystem: { type: Date, required: true },
      hundredHour: { type: Date },
    },
    currentHours: {
      hobbs: { type: Number, required: true, default: 0 },
      tach: { type: Number, required: true, default: 0 },
    },
    safetyAnalysis: {
      lastAnalyzed: { type: Date },
      score: { type: Number },
      findings: [{
        component: { type: String },
        status: { type: String, enum: ['ok', 'warning', 'critical'] },
        message: { type: String },
        lastMentioned: { type: Date }
      }]
    },
    linkedDocuments: [{ type: Schema.Types.ObjectId, ref: 'ParsedDocument' }],
    logs: [LogEntrySchema],
    owner: {
      name: { type: String },
      email: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model recompilation in Next.js dev mode
// FORCE RECOMPILE in dev to ensure schema updates (like operatingLimits) are picked up
if (process.env.NODE_ENV === 'development' && mongoose.models.Aircraft) {
  delete mongoose.models.Aircraft;
}
const Aircraft: Model<IAircraft> = mongoose.models.Aircraft || mongoose.model<IAircraft>('Aircraft', AircraftSchema);

export default Aircraft;
