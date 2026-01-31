import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface MetricCardProps {
    label: string;
    value: string | number;
    trend?: {
        value: number; // Percentage
        direction: "up" | "down" | "neutral";
        label?: string; // e.g. "vs last month"
    };
    className?: string;
}

export function MetricCard({ label, value, trend, className }: MetricCardProps) {
    return (
        <div className={cn("rounded-lg border border-zinc-200 bg-white p-4 shadow-sm", className)}>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-zinc-900 tracking-tight tabular-nums">
                    {value}
                </span>
            </div>

            {trend && (
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span
                        className={cn(
                            "flex items-center font-medium",
                            trend.direction === "up" && "text-emerald-600",
                            trend.direction === "down" && "text-red-600",
                            trend.direction === "neutral" && "text-zinc-500"
                        )}
                    >
                        {trend.direction === "up" && <ArrowUp className="h-3 w-3 mr-0.5" />}
                        {trend.direction === "down" && <ArrowDown className="h-3 w-3 mr-0.5" />}
                        {trend.direction === "neutral" && <Minus className="h-3 w-3 mr-0.5" />}
                        {Math.abs(trend.value)}%
                    </span>
                    <span className="text-zinc-400">{trend.label || "vs last period"}</span>
                </div>
            )}
        </div>
    );
}
