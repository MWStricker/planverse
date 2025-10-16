import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PromotionManagement } from "./PromotionManagement";
import { PostAnalyticsDashboard } from "./PostAnalyticsDashboard";
import { EngagementChart } from "./EngagementChart";
import { TrendingUp, Target, BarChart3, Eye, Heart, MousePointerClick } from "lucide-react";
import { useAnalytics, type TimeRange } from "@/hooks/useAnalytics";

export const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { summary, timeSeriesData, loading } = useAnalytics(timeRange);
  
  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '24h': return 'last 24 hours';
      case '7d': return 'last 7 days';
      case '30d': return 'last 30 days';
      case 'all': return 'all time';
    }
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track your content performance and promotion campaigns
          </p>
        </div>
        <Select 
          name="analytics-time-range" 
          value={timeRange} 
          onValueChange={(v) => setTimeRange(v as TimeRange)}
        >
          <SelectTrigger id="analytics-time-range-select" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="promotions">
            <Target className="h-4 w-4 mr-2" />
            Promotions
          </TabsTrigger>
          <TabsTrigger value="posts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Post Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary?.totalImpressions.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Across {summary?.totalPosts || 0} posts
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary?.totalEngagement.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Likes, comments, shares
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary?.activePromotions || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently running
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary?.avgEngagementRate.toFixed(2) || 0}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average across all posts
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <EngagementChart data={timeSeriesData} timeRange={getTimeRangeLabel()} />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="promotions">
          <PromotionManagement />
        </TabsContent>
        
        <TabsContent value="posts">
          <PostAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};
