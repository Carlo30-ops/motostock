import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TopProductData {
  name: string;
  revenue: number;
}

interface TopProductsChartProps {
  data: TopProductData[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
        <XAxis
          type="number"
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `$${value.toLocaleString()}`}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={120}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Ingresos"]}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        <Bar
          dataKey="revenue"
          fill="hsl(var(--accent))"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
