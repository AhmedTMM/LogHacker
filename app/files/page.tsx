'use client';

import { useState, useCallback } from 'react';
import { FileText, Upload, Check, X, Loader2, Link2, User, Plane, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { useParsedDocuments, useParseDocument, usePilots, useAircraft, useLinkDocToAircraft, useDeleteParsedDocument } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface QueuedFile {
    id: string;
    file: File;
    status: 'queued' | 'uploading' | 'parsing' | 'completed' | 'failed';
    documentId?: string;
    error?: string;
    pilotId?: string;
    aircraftId?: string;
}

export default function FilesPage() {
    const { data: documents = [], refetch: refetchDocs } = useParsedDocuments();
    const { data: pilots = [] } = usePilots();
    const { data: aircraft = [] } = useAircraft();
    const parseDocument = useParseDocument();
    const linkToAircraft = useLinkDocToAircraft();
    const deleteDocument = useDeleteParsedDocument();

    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [dragOver, setDragOver] = useState(false);

    // Process queue automatically
    const processQueue = useCallback(async (files: File[]) => {
        const newItems: QueuedFile[] = files.map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            status: 'queued' as const,
        }));

        setQueue(prev => [...prev, ...newItems]);

        // Process each file
        for (const item of newItems) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            try {
                const base64 = await fileToBase64(item.file);
                const fileType = item.file.type.includes('pdf') ? 'pdf' : 'image';

                // Determine document type from filename
                const filename = item.file.name.toLowerCase();
                let documentType: 'logbook' | 'maintenance' = 'logbook';
                if (filename.includes('maintenance') || filename.includes('mx') || filename.includes('annual')) {
                    documentType = 'maintenance';
                }

                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'parsing' } : q));

                // Parse synchronously to get results
                await new Promise<void>((resolve, reject) => {
                    parseDocument.mutate({
                        fileBase64: base64,
                        fileType,
                        documentType,
                        filename: item.file.name,
                    }, {
                        onSuccess: (data: any) => {
                            setQueue(prev => prev.map(q => q.id === item.id ? {
                                ...q,
                                status: 'completed',
                                documentId: data?.data?.documentId,
                            } : q));
                            refetchDocs();
                            resolve();
                        },
                        onError: (error: any) => {
                            setQueue(prev => prev.map(q => q.id === item.id ? {
                                ...q,
                                status: 'failed',
                                error: error.message,
                            } : q));
                            reject(error);
                        },
                    });
                });
            } catch (error) {
                setQueue(prev => prev.map(q => q.id === item.id ? {
                    ...q,
                    status: 'failed',
                    error: (error as Error).message,
                } : q));
            }
        }
    }, [parseDocument, refetchDocs]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(
            f => f.type.includes('pdf') || f.type.includes('image')
        );
        if (files.length > 0) processQueue(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) processQueue(files);
    };

    const removeFromQueue = (id: string) => {
        setQueue(prev => prev.filter(q => q.id !== id));
    };

    const handleDelete = (docId: string) => {
        deleteDocument.mutate(docId, {
            onSuccess: () => refetchDocs(),
        });
    };

    const getStatusIcon = (status: QueuedFile['status']) => {
        switch (status) {
            case 'queued': return <Clock className="w-4 h-4 text-zinc-400" />;
            case 'uploading': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'parsing': return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
            case 'completed': return <Check className="w-4 h-4 text-emerald-500" />;
            case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
    };

    const getStatusLabel = (status: QueuedFile['status']) => {
        switch (status) {
            case 'queued': return 'Queued';
            case 'uploading': return 'Uploading...';
            case 'parsing': return 'Parsing...';
            case 'completed': return 'Completed';
            case 'failed': return 'Failed';
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-zinc-50 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">File Manager</h1>
                        <p className="text-zinc-500">Upload, parse, and organize your documents</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-sm">
                            {documents.length} parsed files
                        </Badge>
                    </div>
                </div>

                {/* Upload Zone */}
                <div
                    className={cn(
                        "border-2 border-dashed rounded-xl p-8 text-center transition-all",
                        dragOver
                            ? "border-blue-500 bg-blue-50"
                            : "border-zinc-300 hover:border-zinc-400 bg-white"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
                        <p className="text-lg font-medium text-zinc-700">
                            Drop files here or click to upload
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">
                            PDF, PNG, JPG - Logbooks, maintenance records, POH scans
                        </p>
                    </label>
                </div>

                {/* Upload Queue */}
                {queue.length > 0 && (
                    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                            <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                                <Loader2 className="w-4 h-4" />
                                Upload Queue
                            </h2>
                            <span className="text-sm text-zinc-500">
                                {queue.filter(q => q.status === 'completed').length}/{queue.length} complete
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-100">
                            {queue.map(item => (
                                <div key={item.id} className="px-4 py-3 flex items-center gap-4">
                                    <div className="flex-shrink-0">
                                        {getStatusIcon(item.status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-zinc-900 truncate">{item.file.name}</p>
                                        <p className="text-xs text-zinc-500">{getStatusLabel(item.status)}</p>
                                        {item.error && <p className="text-xs text-red-500">{item.error}</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.status === 'completed' && (
                                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                Parsed
                                            </Badge>
                                        )}
                                        <button
                                            onClick={() => removeFromQueue(item.id)}
                                            className="p-1 hover:bg-zinc-100 rounded"
                                        >
                                            <X className="w-4 h-4 text-zinc-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Parsed Documents */}
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
                        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Parsed Documents
                        </h2>
                    </div>

                    {documents.length > 0 ? (
                        <div className="divide-y divide-zinc-100">
                            {documents.map((doc: any) => (
                                <div key={doc._id} className="px-4 py-4 flex items-center gap-4">
                                    {/* Status Icon */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                        doc.status === 'completed' ? "bg-emerald-100" :
                                            doc.status === 'parsing' ? "bg-purple-100" : "bg-zinc-100"
                                    )}>
                                        {doc.status === 'parsing' ? (
                                            <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                                        ) : doc.status === 'completed' ? (
                                            <Check className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                            <FileText className="w-5 h-5 text-zinc-500" />
                                        )}
                                    </div>

                                    {/* File Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-zinc-900 truncate">{doc.filename}</p>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {doc.documentType}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                                            <span>{formatDate(doc.uploadedAt || doc.createdAt)}</span>
                                            {doc.summary?.totalEntries && (
                                                <span>{doc.summary.totalEntries} entries</span>
                                            )}
                                            {doc.summary?.totalHours && (
                                                <span>{doc.summary.totalHours} hrs</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked To */}
                                    <div className="flex items-center gap-2">
                                        {doc.pilot ? (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                                <User className="w-3 h-3 mr-1" />
                                                {pilots.find((p: any) => p._id === doc.pilot)?.name || 'Pilot'}
                                            </Badge>
                                        ) : doc.aircraft ? (
                                            <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                                <Plane className="w-3 h-3 mr-1" />
                                                {aircraft.find((a: any) => a._id === doc.aircraft)?.tailNumber || 'Aircraft'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-zinc-500">
                                                <Link2 className="w-3 h-3 mr-1" />
                                                Unlinked
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={() => handleDelete(doc._id)}
                                        >
                                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
                            <p className="text-zinc-500">No parsed documents yet</p>
                            <p className="text-sm text-zinc-400 mt-1">Upload files above to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
