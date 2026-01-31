'use client';

import { useState } from 'react';
import { ClipboardCheck, Play, Mail, AlertTriangle, CheckCircle, XCircle, Plane, User, Cloud, RefreshCw, Calendar, MapPin, Search, ArrowRight, Zap, Shield, Gauge } from 'lucide-react';
import { useFlights, useRunFlightAudit, useSendAuditEmail, useWeather } from '@/lib/hooks';
import type { Flight, LegalityCheck } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function FlightsPage() {
  const { data: flights, isLoading, error, refetch } = useFlights({ upcoming: true });
  const runAudit = useRunFlightAudit();
  const sendEmail = useSendAuditEmail();
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [weatherAirport, setWeatherAirport] = useState('');

  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStatusBadgeVariant = (status: string) => status === 'go' ? 'success' : status === 'caution' ? 'warning' : status === 'no-go' ? 'destructive' : 'secondary';
  const getStatusLabel = (status: string) => status === 'go' ? 'GO' : status === 'caution' ? 'CAUTION' : status === 'no-go' ? 'NO-GO' : 'PENDING';

  const handleRunAudit = (flightId: string) => runAudit.mutate(flightId, { onSuccess: (data) => setSelectedFlight(data) });
  const handleSendEmail = (flightId: string) => sendEmail.mutate(flightId);

  // Calculate risk scenarios for selected flight
  const getRiskScenarios = (flight: Flight) => {
    const pilot = flight.pilot as any;
    const aircraft = flight.aircraft as any;
    const weather = flight.weather;
    const scheduledDate = new Date(flight.scheduledDate);
    const hour = scheduledDate.getHours();
    const isNightFlight = hour >= 19 || hour <= 6;

    // Prefer server-side audit if available
    const snapshot = flight.safetyAnalysisSnapshot;
    if (snapshot && snapshot.riskScenarios) {
      return snapshot.riskScenarios;
    }

    const scenarios: { title: string; probability: number; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }[] = [];

    // Alternator Failure Scenario
    const airframeHours = aircraft?.currentHours?.hobbs || 0;
    const alternatorRisk = Math.min(Math.round((airframeHours % 500) / 500 * 15), 15);
    let alternatorSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (isNightFlight && alternatorRisk > 5) alternatorSeverity = 'high';
    if (isNightFlight && (pilot?.experience?.nightHours || 0) < 20) alternatorSeverity = 'critical';

    scenarios.push({
      title: 'Electrical Failure',
      probability: alternatorRisk,
      severity: alternatorSeverity,
      description: isNightFlight
        ? `${alternatorRisk}% alternator failure risk. Night flight with ${pilot?.experience?.nightHours || 0} night hours - NO LIGHTS/RADIOS would be catastrophic.`
        : `${alternatorRisk}% alternator failure risk. Daylight operations reduce severity.`
    });

    // Weather Deterioration
    if (weather) {
      let wxRisk = 5;
      if (weather.flightCategory === 'MVFR') wxRisk = 20;
      if (weather.flightCategory === 'IFR') wxRisk = 40;
      if (weather.flightCategory === 'LIFR') wxRisk = 60;

      const isIRPilot = pilot?.certificates?.instrumentRated;
      let wxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (wxRisk >= 20 && !isIRPilot) wxSeverity = 'high';
      if (wxRisk >= 40 && !isIRPilot) wxSeverity = 'critical';

      scenarios.push({
        title: 'Weather Below Minimums',
        probability: wxRisk,
        severity: wxSeverity,
        description: !isIRPilot && wxRisk >= 20
          ? `${weather.flightCategory} conditions with VFR-only pilot. If weather worsens, pilot lacks instrument capability.`
          : `Current: ${weather.flightCategory}. Ceiling ${weather.ceiling || 'CLR'}, vis ${weather.visibility}SM.`
      });
    }

    // Pilot Experience Gap
    const isStudent = pilot?.certificates?.type === 'Student';
    const totalHours = pilot?.experience?.totalHours || 0;
    if (isStudent || totalHours < 100) {
      const expRisk = isStudent ? 25 : Math.max(15 - totalHours / 10, 5);
      let expSeverity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (isStudent && flight.arrivalAirport && flight.arrivalAirport !== flight.departureAirport) expSeverity = 'high';
      if (isStudent && isNightFlight) expSeverity = 'critical';

      scenarios.push({
        title: 'Pilot Inexperience',
        probability: Math.round(expRisk),
        severity: expSeverity,
        description: isStudent
          ? `Student pilot with ${totalHours} total hours. ${isNightFlight ? 'NIGHT FLIGHT - requires endorsement.' : flight.arrivalAirport ? 'Solo XC - ensure proper endorsements.' : ''}`
          : `Low-time pilot (${totalHours} hrs). Consider additional pre-flight briefing.`
      });
    }

    // Engine/Mechanical
    const engineHours = airframeHours % 2000;
    const engineRisk = Math.min(Math.round(engineHours / 2000 * 10), 10);
    scenarios.push({
      title: 'Engine Failure',
      probability: engineRisk,
      severity: engineRisk > 5 && flight.arrivalAirport ? 'medium' : 'low',
      description: `${engineRisk}% risk based on TBO position. ${engineHours.toFixed(0)} hrs since major overhaul.`
    });

    return scenarios.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>;
  if (error) return <div className="text-center py-12"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" /><p className="text-zinc-600">Failed to load flights.</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Flight Risk Analysis</h1>
          <p className="text-sm text-zinc-500">Weather, pilot, aircraft, and scenario-based risk assessment.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Left Column: List & Weather */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Weather Widget */}
          <WeatherLookup airport={weatherAirport} onAirportChange={setWeatherAirport} />

          {/* Upcoming Flights List */}
          <div className="border border-zinc-200 rounded-xl bg-white flex flex-col overflow-hidden shadow-sm flex-1">
            <div className="p-3 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h3 className="font-semibold text-zinc-900 text-sm">Upcoming Flights</h3>
              <span className="text-xs text-zinc-500 bg-zinc-200 px-1.5 py-0.5 rounded-full">{flights?.length || 0}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {flights?.map((flight) => {
                const pilot = flight.pilot as any;
                const aircraft = flight.aircraft as any;
                const isSelected = selectedFlight?._id === flight._id;

                return (
                  <div
                    key={flight._id}
                    onClick={() => setSelectedFlight(flight)}
                    className={cn(
                      "group p-3 rounded-lg cursor-pointer transition-all border border-transparent hover:border-zinc-200",
                      isSelected ? "bg-blue-50 border-blue-200 shadow-sm" : "hover:bg-zinc-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getStatusBadgeVariant(flight.overallStatus)} className="text-[10px] h-5 px-1.5">
                        {getStatusLabel(flight.overallStatus)}
                      </Badge>
                      <span className="text-xs text-zinc-500 font-mono">{formatDate(flight.scheduledDate)}</span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("font-bold text-sm", isSelected ? "text-blue-900" : "text-zinc-900")}>{aircraft?.tailNumber}</span>
                      <span className="text-zinc-300 text-xs">|</span>
                      <span className="text-xs text-zinc-600 truncate">{pilot?.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                      <span>{flight.departureAirport}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-300" />
                      <span>{flight.arrivalAirport || 'Local'}</span>
                    </div>
                  </div>
                );
              })}
              {(!flights || flights.length === 0) && (
                <div className="text-center py-12">
                  <Plane className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No upcoming flights.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detail Panel */}
        <div className="lg:col-span-2 border border-zinc-200 rounded-xl bg-white flex flex-col shadow-sm overflow-hidden">
          {selectedFlight ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-zinc-100 flex items-start justify-between bg-zinc-50/30">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getStatusBadgeVariant(selectedFlight.overallStatus)} className="text-sm px-2.5 py-0.5">
                      {getStatusLabel(selectedFlight.overallStatus)}
                    </Badge>
                    {selectedFlight.emailSent && (
                      <span className="flex items-center text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3 h-3 mr-1" /> Email Sent
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900">{(selectedFlight.aircraft as any)?.tailNumber} Risk Report</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                    <div className="flex items-center gap-1.5"><User className="w-4 h-4" /> {(selectedFlight.pilot as any)?.name}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(selectedFlight.scheduledDate)}</div>
                    <div className="flex items-center gap-1.5 font-mono"><MapPin className="w-4 h-4" /> {selectedFlight.departureAirport} → {selectedFlight.arrivalAirport || 'Local'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleRunAudit(selectedFlight._id)} disabled={runAudit.isPending} variant="default" className="bg-zinc-900 hover:bg-zinc-800">
                    {runAudit.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Run Audit
                  </Button>
                  <Button onClick={() => handleSendEmail(selectedFlight._id)} disabled={sendEmail.isPending || selectedFlight.overallStatus === 'no-go'} variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 space-y-6">
                {/* Risk Matrix */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-900 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-amber-500" /> Risk Scenarios
                  </h3>
                  <div className="space-y-3">
                    {getRiskScenarios(selectedFlight).map((scenario: any, i: number) => (
                      <RiskScenarioCard key={i} {...scenario} />
                    ))}
                  </div>
                </div>

                {/* Pilot Assessment */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-zinc-200 p-4">
                    <h4 className="text-sm font-semibold text-zinc-900 flex items-center mb-3">
                      <User className="w-4 h-4 mr-2 text-blue-500" /> Pilot
                    </h4>
                    <PilotAssessment pilot={selectedFlight.pilot as any} />
                  </div>
                  <div className="bg-white rounded-lg border border-zinc-200 p-4">
                    <h4 className="text-sm font-semibold text-zinc-900 flex items-center mb-3">
                      <Plane className="w-4 h-4 mr-2 text-emerald-500" /> Aircraft
                    </h4>
                    <AircraftAssessment aircraft={selectedFlight.aircraft as any} />
                  </div>
                </div>

                {/* Weather at Airports */}
                {selectedFlight.weather && (
                  <div className="bg-white rounded-lg border border-zinc-200 p-4">
                    <h4 className="text-sm font-semibold text-zinc-900 flex items-center mb-3">
                      <Cloud className="w-4 h-4 mr-2 text-sky-500" /> Weather at {selectedFlight.departureAirport}
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-2 bg-zinc-50 rounded">
                        <div className={cn("text-lg font-bold",
                          selectedFlight.weather.flightCategory === 'VFR' && "text-green-600",
                          selectedFlight.weather.flightCategory === 'MVFR' && "text-blue-600",
                          selectedFlight.weather.flightCategory === 'IFR' && "text-red-600",
                          selectedFlight.weather.flightCategory === 'LIFR' && "text-purple-600",
                        )}>{selectedFlight.weather.flightCategory}</div>
                        <div className="text-xs text-zinc-500">Category</div>
                      </div>
                      <div className="text-center p-2 bg-zinc-50 rounded">
                        <div className="text-lg font-bold text-zinc-900">{selectedFlight.weather.wind?.speed || 0}kt</div>
                        <div className="text-xs text-zinc-500">Wind</div>
                      </div>
                      <div className="text-center p-2 bg-zinc-50 rounded">
                        <div className="text-lg font-bold text-zinc-900">{selectedFlight.weather.visibility}SM</div>
                        <div className="text-xs text-zinc-500">Visibility</div>
                      </div>
                      <div className="text-center p-2 bg-zinc-50 rounded">
                        <div className="text-lg font-bold text-zinc-900">{selectedFlight.weather.ceiling || 'CLR'}</div>
                        <div className="text-xs text-zinc-500">Ceiling</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-zinc-500 bg-zinc-50 p-2 rounded mt-3 break-all">{selectedFlight.weather.metar}</div>
                  </div>
                )}

                {/* Legality Checks */}
                {selectedFlight.legalityChecks && selectedFlight.legalityChecks.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center">
                      <ClipboardCheck className="w-4 h-4 mr-2 text-zinc-500" /> FAA Compliance Checks
                    </h3>
                    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                      <div className="divide-y divide-zinc-100">
                        {selectedFlight.legalityChecks.map((check, idx) => (
                          <div key={idx} className="p-3 flex items-center gap-3">
                            {check.status === 'pass' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                            {check.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                            {check.status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
                            <div className="flex-1">
                              <span className="text-sm font-medium text-zinc-900">{check.item}</span>
                              <span className="text-xs text-zinc-500 ml-2">{check.message}</span>
                            </div>
                            <Badge variant={check.status === 'pass' ? 'secondary' : check.status === 'warning' ? 'warning' : 'destructive'} className="text-[10px]">
                              {check.status.toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-50/50">
              <div className="w-16 h-16 bg-white border border-zinc-200 rounded-full flex items-center justify-center shadow-sm mb-4">
                <Plane className="w-8 h-8 text-zinc-300 transform -rotate-45" />
              </div>
              <h3 className="text-lg font-medium text-zinc-900">No Flight Selected</h3>
              <p className="text-zinc-500 max-w-xs mx-auto mt-2">Select a flight to view risk analysis, weather, and compliance status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskScenarioCard({ title, probability, severity, description }: { title: string; probability: number; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }) {
  const severityColors = {
    low: 'border-emerald-200 bg-emerald-50',
    medium: 'border-amber-200 bg-amber-50',
    high: 'border-orange-200 bg-orange-50',
    critical: 'border-red-200 bg-red-50',
  };
  const severityTextColors = {
    low: 'text-emerald-700',
    medium: 'text-amber-700',
    high: 'text-orange-700',
    critical: 'text-red-700',
  };
  const severityBadge = {
    low: 'secondary',
    medium: 'warning',
    high: 'warning',
    critical: 'destructive',
  } as const;

  return (
    <div className={cn("p-4 rounded-lg border", severityColors[severity])}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={cn("font-semibold text-sm", severityTextColors[severity])}>{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-600">{probability}% prob</span>
          <Badge variant={severityBadge[severity]} className="text-xs">{severity.toUpperCase()}</Badge>
        </div>
      </div>
      <p className="text-sm text-zinc-600">{description}</p>
    </div>
  );
}

function PilotAssessment({ pilot }: { pilot: any }) {
  if (!pilot) return <p className="text-sm text-zinc-500">No pilot data</p>;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Certificate</span>
        <span className="font-medium">{pilot.certificates?.type || 'Unknown'}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Total Hours</span>
        <span className="font-medium">{pilot.experience?.totalHours || 0}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Night Hours</span>
        <span className="font-medium">{pilot.experience?.nightHours || 0}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Instrument</span>
        <span className="font-medium">{pilot.certificates?.instrumentRated ? 'Yes' : 'No'}</span>
      </div>
      {pilot.safetyAnalysis && (
        <div className="flex justify-between text-sm pt-2 border-t border-zinc-100">
          <span className="text-zinc-500">Safety Score</span>
          <Badge variant={pilot.safetyAnalysis.score > 7 ? 'destructive' : pilot.safetyAnalysis.score > 4 ? 'warning' : 'success'}>
            {pilot.safetyAnalysis.score}/10 Risk
          </Badge>
        </div>
      )}
    </div>
  );
}

function AircraftAssessment({ aircraft }: { aircraft: any }) {
  if (!aircraft) return <p className="text-sm text-zinc-500">No aircraft data</p>;

  const getDaysUntil = (date: Date | string) => Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const annualDays = getDaysUntil(aircraft.maintenanceDates?.annual);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Tail</span>
        <span className="font-medium font-mono">{aircraft.tailNumber}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Model</span>
        <span className="font-medium">{aircraft.model}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Hobbs</span>
        <span className="font-medium">{aircraft.currentHours?.hobbs?.toFixed(1) || 0}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Annual Due</span>
        <span className={cn("font-medium", annualDays < 30 ? "text-red-600" : "")}>{annualDays}d</span>
      </div>
    </div>
  );
}

function WeatherLookup({ airport, onAirportChange }: { airport: string; onAirportChange: (v: string) => void }) {
  const { data: weather, isLoading, error } = useWeather(airport);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'VFR': return 'text-green-600 bg-green-50 border-green-200';
      case 'MVFR': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'IFR': return 'text-red-600 bg-red-50 border-red-200';
      case 'LIFR': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-zinc-600 bg-zinc-50 border-zinc-200';
    }
  };

  return (
    <div className="border border-zinc-200 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center">
        <Cloud className="w-4 h-4 mr-2 text-zinc-500" />
        Weather Lookup
      </h3>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="ICAO (e.g. KJFK)"
          value={airport}
          onChange={(e) => onAirportChange(e.target.value.toUpperCase())}
          className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono"
          maxLength={4}
        />
      </div>

      {isLoading && airport.length >= 3 && (
        <div className="flex items-center justify-center py-2">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
        </div>
      )}

      {error && airport.length >= 3 && (
        <Badge variant="destructive" className="w-full justify-center">Fetch Failed</Badge>
      )}

      {weather && !isLoading && (
        <div className="space-y-3">
          <div className={cn("text-center py-1 rounded border text-sm font-bold", getCategoryColor(weather.flightCategory))}>
            {weather.flightCategory}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-zinc-50 rounded">
              <div className="text-zinc-500 mb-0.5">Wind</div>
              <div className="font-medium text-zinc-900">{weather.wind?.speed || 0}kt</div>
            </div>
            <div className="p-2 bg-zinc-50 rounded">
              <div className="text-zinc-500 mb-0.5">Vis</div>
              <div className="font-medium text-zinc-900">{weather.visibility}sm</div>
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-400 break-all leading-tight bg-zinc-50 p-2 rounded">
            {weather.metar}
          </div>
        </div>
      )}
    </div>
  );
}
