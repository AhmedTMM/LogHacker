'use client';

import { useState, useEffect } from 'react';
import { Plane, Plus, AlertTriangle, CheckCircle, Clock, Wrench, Trash2, X, Upload, FileText, Loader2, Image as ImageIcon, Link2, Unlink, Search, ShieldCheck } from 'lucide-react';
import { useAircraft, useCreateAircraft, useDeleteAircraft, useParseDocument, useParsedDocuments, useLinkDocToAircraft } from '@/lib/hooks';
import type { Aircraft } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { cn } from '@/lib/utils';

export default function AircraftPage() {
    const { data: fleet, isLoading, error, refetch } = useAircraft();
    const createAircraft = useCreateAircraft();
    const deleteAircraft = useDeleteAircraft();
    const parseDocument = useParseDocument();
    const { data: parsedDocs, refetch: refetchDocs } = useParsedDocuments({ documentType: 'maintenance' });
    const linkDoc = useLinkDocToAircraft();

    const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'logbook' | 'analysis'>('details');
    const [logbookYear, setLogbookYear] = useState<string>('All');

    useEffect(() => {
        setLogbookYear('All');
    }, [selectedAircraft?._id]);

    const logs = selectedAircraft?.logs || [];
    const years = Array.from(new Set(logs.map(l => new Date(l.date).getFullYear()))).sort((a, b) => b - a);
    const filteredLogs = logbookYear === 'All'
        ? logs
        : logs.filter(l => new Date(l.date).getFullYear() === parseInt(logbookYear));

    const getDaysUntil = (date: Date | string) => Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    const handleLogbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedAircraft) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            parseDocument.mutate({
                fileBase64: base64,
                fileType: file.type.includes('pdf') ? 'pdf' : 'image',
                documentType: 'maintenance',
                aircraftId: selectedAircraft._id,
                filename: file.name,
                background: true, // Background processing
            }, {
                onSuccess: () => {
                    refetch();
                    refetchDocs();
                },
            });
        };
        reader.readAsDataURL(file);
    };

    const handleLinkDoc = (docId: string) => {
        if (!selectedAircraft) return;
        linkDoc.mutate({ docId, aircraftId: selectedAircraft._id }, {
            onSuccess: () => {
                refetch();
                refetchDocs();
            },
        });
    };

    const handleUnlinkDoc = (docId: string) => {
        linkDoc.mutate({ docId, aircraftId: null }, {
            onSuccess: () => {
                refetch();
                refetchDocs();
            },
        });
    };


    if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
    if (error) return <div className="text-center py-12"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" /><p className="text-zinc-600">Failed to load aircraft fleet.</p></div>;

    const fleetSize = fleet?.length || 0;
    const maintenanceDue = fleet?.filter(ac => getDaysUntil(ac.maintenanceDates.annual) < 30).length || 0;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Fleet Management</h1>
                    <p className="text-sm text-zinc-500">Track airworthiness, maintenance, and logbooks.</p>
                </div>
                <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Aircraft
                </Button>
            </div>

            {/* Stats Row */}
            <div className="grid gap-4 md:grid-cols-4 flex-shrink-0">
                <MetricCard label="Active Fleet" value={fleetSize} />
                <MetricCard label="Maintenance Due" value={maintenanceDue} className={maintenanceDue > 0 ? "border-l-4 border-l-red-500" : ""} />
                <MetricCard label="Total Fleet Hours" value={fleet?.reduce((acc, curr) => acc + curr.currentHours.hobbs, 0).toFixed(1) || '0.0'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Aircraft List */}
                <div className="lg:col-span-1 border border-zinc-200 rounded-xl bg-white flex flex-col overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-zinc-100 bg-zinc-50/50">
                        <input
                            type="text"
                            placeholder="Search tail number..."
                            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {fleet?.map((ac) => {
                            const annualDays = getDaysUntil(ac.maintenanceDates.annual);
                            const isMaintenanceDue = annualDays < 30;
                            const isSelected = selectedAircraft?._id === ac._id;

                            return (
                                <div
                                    key={ac._id}
                                    onClick={() => { setSelectedAircraft(ac); setActiveTab('details'); }}
                                    className={cn(
                                        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border border-transparent",
                                        isSelected ? "bg-blue-50 border-blue-200 shadow-sm" : "hover:bg-zinc-50 hover:border-zinc-200"
                                    )}
                                >
                                    {/* Aircraft Image Thumbnail */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-lg flex items-center justify-center border overflow-hidden",
                                        isSelected ? "border-blue-200" : "border-zinc-200"
                                    )}>
                                        {ac.imageUrl ? (
                                            <img src={ac.imageUrl} alt={ac.tailNumber} className="w-full h-full object-cover" />
                                        ) : (
                                            <Plane className={cn("w-5 h-5", isSelected ? "text-blue-600" : "text-zinc-400")} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3 className={cn("font-bold text-sm", isSelected ? "text-blue-900" : "text-zinc-900")}>{ac.tailNumber}</h3>
                                            {isMaintenanceDue && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-xs text-zinc-500 truncate">{ac.model}</p>
                                            <span className="text-[10px] font-mono text-zinc-400">{ac.currentHours.hobbs} HOBBS</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Aircraft Details Panel */}
                <div className="lg:col-span-2 border border-zinc-200 rounded-xl bg-white flex flex-col shadow-sm overflow-hidden">
                    {selectedAircraft ? (
                        <>
                            {/* Detail Header with Image */}
                            <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 bg-white border border-zinc-200 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                                        {selectedAircraft.imageUrl ? (
                                            <img src={selectedAircraft.imageUrl} alt={selectedAircraft.tailNumber} className="w-full h-full object-cover" />
                                        ) : (
                                            <Plane className="w-10 h-10 text-zinc-300" />
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-zinc-900">{selectedAircraft.tailNumber}</h2>
                                        <p className="text-sm text-zinc-500 font-medium">{selectedAircraft.year} {selectedAircraft.manufacturer} {selectedAircraft.model}</p>
                                        <div className="flex gap-2 mt-2">
                                            <Badge variant="outline" className="font-mono">SN: {selectedAircraft.serial}</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setShowDeleteModal(true)}>
                                        <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setSelectedAircraft(null)}>
                                        <X className="w-4 h-4 text-zinc-400" />
                                    </Button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-zinc-100">
                                <button
                                    onClick={() => setActiveTab('details')}
                                    className={cn(
                                        "px-4 py-3 text-sm font-medium transition-colors",
                                        activeTab === 'details' ? "text-blue-600 border-b-2 border-blue-600" : "text-zinc-500 hover:text-zinc-700"
                                    )}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setActiveTab('logbook')}
                                    className={cn(
                                        "px-4 py-3 text-sm font-medium transition-colors",
                                        activeTab === 'logbook' ? "text-blue-600 border-b-2 border-blue-600" : "text-zinc-500 hover:text-zinc-700"
                                    )}
                                >
                                    Logbook
                                </button>
                                <button
                                    onClick={() => setActiveTab('analysis')}
                                    className={cn(
                                        "px-4 py-3 text-sm font-medium transition-colors",
                                        activeTab === 'analysis' ? "text-blue-600 border-b-2 border-blue-600" : "text-zinc-500 hover:text-zinc-700"
                                    )}
                                >
                                    Risk Analysis
                                </button>
                            </div>

                            {/* Content Area */}
                            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 space-y-6">
                                {activeTab === 'details' ? (
                                    <>
                                        {/* Times */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-white rounded-lg border border-zinc-200 shadow-sm">
                                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Hobbs Time</div>
                                                <div className="text-3xl font-bold tabular-nums text-zinc-900">{selectedAircraft.currentHours.hobbs.toFixed(1)}</div>
                                            </div>
                                            <div className="p-4 bg-white rounded-lg border border-zinc-200 shadow-sm">
                                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Tach Time</div>
                                                <div className="text-3xl font-bold tabular-nums text-zinc-900">{selectedAircraft.currentHours.tach.toFixed(1)}</div>
                                            </div>
                                        </div>

                                        {/* Maintenance Status */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-zinc-900 flex items-center"><Wrench className="w-4 h-4 mr-2" /> Maintenance Status</h3>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <MaintenanceItem label="Annual Inspection" date={selectedAircraft.maintenanceDates.annual} />
                                                <MaintenanceItem label="Transponder Check" date={selectedAircraft.maintenanceDates.transponder} />
                                                <MaintenanceItem label="Pitot-Static" date={selectedAircraft.maintenanceDates.staticSystem} />
                                                {selectedAircraft.maintenanceDates.hundredHour && (
                                                    <MaintenanceItem label="100-Hour Inspection" date={selectedAircraft.maintenanceDates.hundredHour} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Risk Indicators */}
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-zinc-900 flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> Component Risk</h3>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <RiskIndicator label="Alternator" hours={selectedAircraft.currentHours.hobbs} baselineHours={500} />
                                                <RiskIndicator label="Vacuum Pump" hours={selectedAircraft.currentHours.hobbs} baselineHours={400} />
                                                <RiskIndicator label="Magnetos" hours={selectedAircraft.currentHours.hobbs} baselineHours={500} />
                                                <RiskIndicator label="Engine" hours={selectedAircraft.currentHours.hobbs} baselineHours={2000} />
                                            </div>
                                        </div>
                                    </>
                                ) : activeTab === 'analysis' ? (
                                    <RiskAnalysisPanel aircraft={selectedAircraft} onAnalyze={() => { refetch(); }} />
                                ) : (
                                    <>
                                        {/* Logbook Upload */}
                                        <div className="border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center hover:border-zinc-400 transition-colors">
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handleLogbookUpload}
                                                className="hidden"
                                                id="logbook-upload"
                                                disabled={parseDocument.isPending}
                                            />
                                            <label htmlFor="logbook-upload" className="cursor-pointer">
                                                {parseDocument.isPending ? (
                                                    <div className="flex flex-col items-center">
                                                        <Loader2 className="w-10 h-10 text-blue-500 mb-3 animate-spin" />
                                                        <p className="text-sm font-medium text-blue-600">Uploading in background...</p>
                                                        <p className="text-xs text-zinc-500">You can continue working</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="w-10 h-10 mx-auto text-zinc-400 mb-3" />
                                                        <p className="text-sm font-medium text-zinc-700">Upload Maintenance Logbook</p>
                                                        <p className="text-xs text-zinc-500 mt-1">PDF or image - parses in background</p>
                                                    </>
                                                )}
                                            </label>
                                        </div>

                                        {/* Linked Files */}
                                        {parsedDocs && parsedDocs.filter(d => d.aircraft === selectedAircraft._id).length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-zinc-900 flex items-center">
                                                    <Link2 className="w-4 h-4 mr-2" /> Linked Documents
                                                </h3>
                                                {parsedDocs.filter(d => d.aircraft === selectedAircraft._id).map((doc) => (
                                                    <div key={doc._id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="w-5 h-5 text-emerald-600" />
                                                            <div>
                                                                <p className="text-sm font-medium text-zinc-900">{doc.filename}</p>
                                                                <p className="text-xs text-zinc-500">
                                                                    {doc.summary?.totalEntries || 0} entries • {doc.summary?.totalHours?.toFixed(1) || 0} hours
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={doc.status === 'completed' ? 'success' : doc.status === 'parsing' ? 'warning' : 'secondary'}>
                                                                {doc.status}
                                                            </Badge>
                                                            <Button size="sm" variant="ghost" onClick={() => handleUnlinkDoc(doc._id)}>
                                                                <Unlink className="w-4 h-4 text-zinc-400" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Available Files to Link */}
                                        {parsedDocs && parsedDocs.filter(d => !d.aircraft && d.status === 'completed').length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-zinc-900 flex items-center">
                                                    <FileText className="w-4 h-4 mr-2" /> Available to Link
                                                </h3>
                                                {parsedDocs.filter(d => !d.aircraft && d.status === 'completed').map((doc) => (
                                                    <div key={doc._id} className="bg-white border border-zinc-200 rounded-lg p-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <FileText className="w-5 h-5 text-zinc-400" />
                                                            <div>
                                                                <p className="text-sm font-medium text-zinc-900">{doc.filename}</p>
                                                                <p className="text-xs text-zinc-500">
                                                                    {doc.summary?.totalEntries || 0} entries • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button size="sm" variant="outline" onClick={() => handleLinkDoc(doc._id)}>
                                                            <Link2 className="w-4 h-4 mr-1" /> Link
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}


                                        {/* Maintenance Log Entries */}
                                        {selectedAircraft.logs && selectedAircraft.logs.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center">
                                                        <Clock className="w-4 h-4 mr-2" /> Maintenance History
                                                    </h3>
                                                    <select
                                                        className="h-8 pl-2 pr-8 text-xs bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                                                        value={logbookYear}
                                                        onChange={(e) => setLogbookYear(e.target.value)}
                                                    >
                                                        <option value="All">All Years</option>
                                                        {years.map(year => (
                                                            <option key={year} value={year}>{year}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-zinc-50 border-b border-zinc-200">
                                                            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider">
                                                                <th className="px-4 py-3">Date</th>
                                                                <th className="px-4 py-3">Description</th>
                                                                <th className="px-4 py-3">Mechanic</th>
                                                                <th className="px-4 py-3 text-right">Hobbs</th>
                                                                <th className="px-4 py-3 text-right">Tach</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-zinc-100">
                                                            {filteredLogs.map((log, i) => (
                                                                <tr key={i} className="hover:bg-zinc-50 transition-colors">
                                                                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 w-24">
                                                                        {new Date(log.date).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-medium text-zinc-900">
                                                                        {log.description}
                                                                        {log.rawText && (
                                                                            <p className="text-xs text-zinc-400 font-normal mt-0.5 line-clamp-1">{log.rawText}</p>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-zinc-600 w-32">
                                                                        {log.mechanic ? (
                                                                            <Badge variant="outline" className="text-xs font-normal bg-white">
                                                                                {log.mechanic}
                                                                            </Badge>
                                                                        ) : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono text-zinc-700 w-24">
                                                                        {log.hobbsTime.toFixed(1)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-mono text-zinc-500 w-24">
                                                                        {log.tachTime.toFixed(1)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {filteredLogs.length === 0 && (
                                                        <div className="p-8 text-center text-zinc-500 text-sm">
                                                            No logs found for this year.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-50/50">
                            <div className="w-16 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Plane className="w-8 h-8 text-zinc-300" />
                            </div>
                            <h3 className="text-lg font-medium text-zinc-900">No Aircraft Selected</h3>
                            <p className="text-zinc-500 max-w-xs mx-auto mt-2">Select an aircraft to view maintenance status, logbook, and risk analysis.</p>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && <AddAircraftModal onClose={() => setShowAddModal(false)} onCreate={(data) => createAircraft.mutate(data, { onSuccess: () => setShowAddModal(false) })} isLoading={createAircraft.isPending} />}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedAircraft && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <div className="bg-red-50 p-2 rounded-full"><AlertTriangle className="w-6 h-6" /></div>
                            <h3 className="text-lg font-bold text-zinc-900">Remove Aircraft?</h3>
                        </div>
                        <p className="text-zinc-600 mb-6 text-sm">
                            Are you sure you want to remove <strong>{selectedAircraft.tailNumber}</strong>? This will also delete all associated maintenance logs.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleteAircraft.isPending}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    deleteAircraft.mutate(selectedAircraft._id, {
                                        onSuccess: () => {
                                            setShowDeleteModal(false);
                                            setSelectedAircraft(null);
                                        }
                                    });
                                }}
                                disabled={deleteAircraft.isPending}
                            >
                                {deleteAircraft.isPending ? 'Removing...' : 'Remove Aircraft'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MaintenanceItem({ label, date }: { label: string; date: Date | string }) {
    const daysLeft = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const status = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'warning' : 'valid';

    return (
        <div className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg">
            <div>
                <div className="flex items-center gap-2">
                    {status === 'valid' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    <span className="text-sm font-medium text-zinc-900">{label}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 ml-5.5">{new Date(date).toLocaleDateString()}</p>
            </div>
            <Badge variant={status === 'valid' ? 'secondary' : status === 'warning' ? 'warning' : 'destructive'} className="text-[10px]">
                {daysLeft < 0 ? `Expired` : `${daysLeft}d left`}
            </Badge>
        </div>
    );
}

function RiskIndicator({ label, hours, baselineHours }: { label: string; hours: number; baselineHours: number }) {
    // Simple risk model: risk increases as hours approach typical overhaul interval
    const hoursSinceNew = hours % baselineHours; // Assume reset at each overhaul
    const riskPercent = Math.min(Math.round((hoursSinceNew / baselineHours) * 30), 30); // Max 30% risk
    const riskLevel = riskPercent < 10 ? 'low' : riskPercent < 20 ? 'medium' : 'high';

    return (
        <div className="p-3 bg-white border border-zinc-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-900">{label}</span>
                <Badge variant={riskLevel === 'low' ? 'secondary' : riskLevel === 'medium' ? 'warning' : 'destructive'} className="text-[10px]">
                    {riskPercent}% risk
                </Badge>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all",
                        riskLevel === 'low' ? 'bg-emerald-500' : riskLevel === 'medium' ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${riskPercent}%` }}
                />
            </div>
            <p className="text-xs text-zinc-500 mt-1">{hoursSinceNew.toFixed(0)} hrs since overhaul</p>
        </div>
    );
}

function RiskAnalysisPanel({ aircraft, onAnalyze }: { aircraft: Aircraft; onAnalyze: () => void }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch(`/api/aircraft/${aircraft._id}/analyze`, { method: 'POST' });
            if (res.ok) {
                onAnalyze();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const analysis = aircraft.safetyAnalysis;

    return (
        <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start justify-between">
                <div>
                    <h3 className="text-sm font-bold text-blue-900">AI Maintenance Analysis</h3>
                    <p className="text-xs text-blue-700 mt-1">
                        Scans linked logbooks for key component history (Magnetos, Vacuum Pumps, Cylinders) to identify overdue maintenance.
                    </p>
                </div>
                <Button size="sm" onClick={handleRunAnalysis} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                    {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </Button>
            </div>

            {analysis ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Last Analyzed: {new Date(analysis.lastAnalyzed).toLocaleDateString()}</h4>
                        <Badge variant={analysis.score > 8 ? 'success' : analysis.score > 5 ? 'warning' : 'destructive'}>
                            Safety Score: {analysis.score}/10
                        </Badge>
                    </div>

                    <div className="grid gap-3">
                        {analysis.findings.map((finding: any, i: number) => (
                            <div key={i} className={cn(
                                "p-3 rounded-lg border flex items-start gap-3",
                                finding.status === 'ok' ? "bg-white border-zinc-200" :
                                    finding.status === 'warning' ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
                            )}>
                                {finding.status === 'ok' ? <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" /> : <AlertTriangle className={cn("w-5 h-5 mt-0.5", finding.status === 'warning' ? "text-amber-500" : "text-red-500")} />}
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">{finding.component}</p>
                                    <p className="text-sm text-zinc-600">{finding.message}</p>
                                    {finding.lastMentioned && (
                                        <p className="text-xs text-zinc-500 mt-1">Last seen: {new Date(finding.lastMentioned).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-zinc-500">
                    <ShieldCheck className="w-12 h-12 mx-auto text-zinc-300 mb-2" />
                    <p>No analysis run yet.</p>
                </div>
            )}
        </div>
    );
}

function AddAircraftModal({ onClose, onCreate, isLoading }: { onClose: () => void; onCreate: (data: any) => void; isLoading: boolean }) {
    const [formData, setFormData] = useState({
        tailNumber: '', model: '', manufacturer: '', year: new Date().getFullYear(),
        serial: '', imageUrl: '',
        currentHours: { hobbs: 0, tach: 0 },
        maintenanceDates: {
            annual: new Date().toISOString().slice(0, 10),
            transponder: new Date().toISOString().slice(0, 10),
            staticSystem: new Date().toISOString().slice(0, 10)
        }
    });
    const [isLookingUp, setIsLookingUp] = useState(false);

    const handleLookup = async () => {
        if (!formData.tailNumber) return;
        setIsLookingUp(true);
        try {
            const res = await fetch(`/api/aircraft/lookup?tailNumber=${formData.tailNumber}`);
            const data = await res.json();
            if (data.success && data.data) {
                const ac = data.data;
                setFormData(prev => ({
                    ...prev,
                    model: ac.model || prev.model,
                    manufacturer: ac.manufacturer || prev.manufacturer,
                    year: ac.year || prev.year,
                    serial: ac.serial || prev.serial,
                    imageUrl: ac.imageUrl || prev.imageUrl
                }));
            }
        } catch (e) {
            console.error("Lookup failed", e);
        } finally {
            setIsLookingUp(false);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-zinc-900">Add Aircraft</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-zinc-700">Tail Number</label>
                            <div className="flex gap-2 mt-1">
                                <input required className="w-full px-3 py-2 border border-zinc-300 rounded-lg uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={formData.tailNumber} onChange={e => setFormData({ ...formData, tailNumber: e.target.value.toUpperCase() })} placeholder="N..." />
                                <Button type="button" variant="outline" size="icon" onClick={handleLookup} disabled={isLookingUp} title="Auto-fill" className="shrink-0">
                                    {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        <div><label className="text-sm font-medium text-zinc-700">Model</label><input required className="w-full mt-1.5 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder="172N" /></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium text-zinc-700">Manufacturer</label><input required className="w-full mt-1.5 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="Cessna" /></div>
                        <div><label className="text-sm font-medium text-zinc-700">Year</label><input type="number" required className="w-full mt-1.5 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} /></div>
                    </div>

                    <div><label className="text-sm font-medium text-zinc-700">Serial Number</label><input required className="w-full mt-1.5 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.serial} onChange={e => setFormData({ ...formData, serial: e.target.value })} /></div>

                    <div><label className="text-sm font-medium text-zinc-700">Image URL</label><input className="w-full mt-1.5 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." /></div>

                    <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-900">Current Times</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs text-zinc-500 uppercase">Hobbs</label><input type="number" step="0.1" required className="w-full mt-1 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.currentHours.hobbs} onChange={e => setFormData({ ...formData, currentHours: { ...formData.currentHours, hobbs: parseFloat(e.target.value) } })} /></div>
                            <div><label className="text-xs text-zinc-500 uppercase">Tach</label><input type="number" step="0.1" required className="w-full mt-1 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.currentHours.tach} onChange={e => setFormData({ ...formData, currentHours: { ...formData.currentHours, tach: parseFloat(e.target.value) } })} /></div>
                        </div>
                    </div>

                    <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-900">Maintenance Due Dates</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <div><label className="text-xs text-zinc-500 uppercase">Annual Inspection</label><input type="date" required className="w-full mt-1 px-3 py-2 border border-zinc-300 rounded-lg" value={formData.maintenanceDates.annual as string} onChange={e => setFormData({ ...formData, maintenanceDates: { ...formData.maintenanceDates, annual: e.target.value } })} /></div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                        <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isLoading}>{isLoading ? 'Adding...' : 'Add Aircraft'}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
