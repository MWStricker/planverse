import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { TimeSeriesData } from '@/hooks/useAnalytics';

interface EngagementChartProps {
  data: TimeSeriesData[];
  timeRange: string;
}

export const EngagementChart = ({ data, timeRange }: EngagementChartProps) => {
  const chartConfig = {
    impressions: {
      label: "Impressions",
      color: "hsl(var(--chart-1))"
    },
    engagement: {
      label: "Engagement",
      color: "hsl(var(--chart-2))"
    },
    clicks: {
      label: "Clicks",
      color: "hsl(var(--chart-3))"
    }
  };
  
  const formattedData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    impressions: Number(d.impressions),
    engagement: Number(d.engagement),
    clicks: Number(d.clicks)
  }));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Over Time
        </CardTitle>
        <CardDescription>
          Tracking impressions, engagement, and clicks for the {timeRange}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {formattedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <p>No data available yet</p>
            <p className="text-sm mt-2">Post content to start tracking analytics</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="impressions" 
                  stroke="var(--color-impressions)" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="var(--color-engagement)" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="clicks" 
                  stroke="var(--color-clicks)" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
