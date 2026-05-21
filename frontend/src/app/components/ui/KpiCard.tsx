import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  trend,
  loading,
}: KpiCardProps) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={cn("p-2 rounded-lg", iconClassName)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
        {trend && !loading && (
          <p
            className={cn(
              "text-sm mt-1 font-medium",
              trendUp && "text-success",
              trendDown && "text-destructive",
              trend.value === 0 && "text-muted-foreground"
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value.toFixed(0)}% {trend.label}
          </p>
        )}
        {subtitle && !trend && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
        {subtitle && trend && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
