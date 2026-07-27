import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  isCurrency?: boolean;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ label, value, isCurrency, delta, deltaLabel, icon: Icon, iconColor }: Props) {
  const displayValue = isCurrency ? formatCurrency(value) : value;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{displayValue}</p>
            {delta !== undefined && (
              <p className={cn("text-xs mt-1", delta >= 0 ? "text-green-600" : "text-red-500")}>
                {delta >= 0 ? "+" : ""}{isCurrency ? formatCurrency(delta) : delta.toFixed(1) + "%"}
                {deltaLabel && <span className="text-muted-foreground ml-1">{deltaLabel}</span>}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg", iconColor ?? "bg-primary/10")}>
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
