import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IParsedDocument extends Document {
    filename: string;
    documentType: 'logbook' | 'maintenance' | 'poh' | 'other';
    fileType: 'pdf' | 'image';
    uploadedAt: Date;
    parsedAt?: Date;
    status: 'pending' | 'parsing' | 'completed' | 'failed';

    // The raw Reducto output
    rawOutput?: Record<string, any>;

    // Extracted entries
    entries?: Array<Record<string, any>>;

    // Summary stats
    summary?: {
        totalEntries: number;
        totalHours?: number;
        dateRange?: { from: string; to: string };
    };

    // Link to aircraft (optional)
    aircraft?: mongoose.Types.ObjectId;

    // Link to pilot (optional)
    pilot?: mongoose.Types.ObjectId;

    // Error message if failed
    error?: string;

    // Original file stored as base64 (for re-parsing if needed)
    fileBase64?: string;
}

const ParsedDocumentSchema = new Schema<IParsedDocument>({
    filename: { type: String, required: true },
    documentType: {
        type: String,
        enum: ['logbook', 'maintenance', 'poh', 'other'],
        required: true
    },
    fileType: { type: String, enum: ['pdf', 'image'], required: true },
    uploadedAt: { type: Date, default: Date.now },
    parsedAt: { type: Date },
    status: {
        type: String,
        enum: ['pending', 'parsing', 'completed', 'failed'],
        default: 'pending'
    },
    rawOutput: { type: Schema.Types.Mixed },
    entries: [{ type: Schema.Types.Mixed }],
    summary: {
        totalEntries: { type: Number },
        totalHours: { type: Number },
        dateRange: {
            from: { type: String },
            to: { type: String }
        }
    },
    aircraft: { type: Schema.Types.ObjectId, ref: 'Aircraft' },
    pilot: { type: Schema.Types.ObjectId, ref: 'Pilot' },
    error: { type: String },
    fileBase64: { type: String }
}, {
    timestamps: true
});

// Index for quick lookups
ParsedDocumentSchema.index({ aircraft: 1, documentType: 1 });
ParsedDocumentSchema.index({ pilot: 1, documentType: 1 });
ParsedDocumentSchema.index({ status: 1 });

const ParsedDocument: Model<IParsedDocument> =
    mongoose.models.ParsedDocument || mongoose.model<IParsedDocument>('ParsedDocument', ParsedDocumentSchema);

export default ParsedDocument;
