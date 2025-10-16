import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/useAnalytics";
import { BarChart3, TrendingUp, Eye, Heart, MessageSquare, MousePointerClick, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from 'date-fns';

export const PostAnalyticsDashboard = () => {
  const { postAnalytics, loading } = useAnalytics();
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Post Analytics
        </CardTitle>
        <CardDescription>
          Detailed performance metrics for all your posts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {postAnalytics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm mt-2">Create your first post to see analytics</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">Post</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Eye className="h-3 w-3" />
                      Views
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MousePointerClick className="h-3 w-3" />
                      Clicks
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Heart className="h-3 w-3" />
                      Likes
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Comments
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Share2 className="h-3 w-3" />
                      Shares
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Rate
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postAnalytics.map((post) => (
                  <TableRow key={post.postId}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        {post.postImageUrl && (
                          <Avatar className="h-10 w-10 rounded-md flex-shrink-0">
                            <AvatarImage src={post.postImageUrl} className="object-cover" />
                            <AvatarFallback className="rounded-md">IMG</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-clamp-2 font-medium">
                            {post.postContent}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(post.postCreatedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {post.isPromoted ? (
                        <Badge variant="default" className="whitespace-nowrap">
                          Promoted
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          Organic
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {post.totalImpressions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {post.totalClicks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {post.totalLikes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {post.totalComments.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {post.totalShares.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-primary">
                        {post.engagementRate.toFixed(2)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
