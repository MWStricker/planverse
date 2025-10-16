import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromotionManagement } from "./PromotionManagement";
import { PostAnalyticsDashboard } from "./PostAnalyticsDashboard";
import { TrendingUp, Target, BarChart3 } from "lucide-react";

export const AnalyticsDashboard = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Track your content performance and promotion campaigns
        </p>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total Impressions</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Coming Soon</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Total Engagement</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Coming Soon</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Active Promotions</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Coming Soon</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">Engagement Rate</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Coming Soon</p>
            </div>
          </div>
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
