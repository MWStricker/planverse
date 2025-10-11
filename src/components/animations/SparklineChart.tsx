import { memo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export const SparklineChart = memo(({ data, color = "hsl(var(--primary))", height = 40 }: SparklineChartProps) => {
  if (!data || data.length === 0) return null;

  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color}
          strokeWidth={2}
          dot={false}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

SparklineChart.displayName = 'SparklineChart';
