import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StageChartData {
  name: string;
  Completed: number;
  Active: number;
  Blocked: number;
  "Not started": number;
}

export default function StageBarChart({ data }: { data: StageChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 12, right: 10, left: -20, bottom: 2 }}
        barGap={4}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#edf0f3"
        />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "#667085" }}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#8a94a4" }}
        />
        <Tooltip
          cursor={{ fill: "#f5f7fa" }}
          contentStyle={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="Completed" stackId="a" fill="#3c8062" />
        <Bar dataKey="Active" stackId="a" fill="#4776a8" />
        <Bar dataKey="Blocked" stackId="a" fill="#bd645c" />
        <Bar
          dataKey="Not started"
          stackId="a"
          fill="#dfe4ea"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
