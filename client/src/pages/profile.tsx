import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/initials";
import type { Record } from "@shared/schema";

const LIST_NAMES: Record<string, string> = {
  demonlist: "Demonlist",
  challenge: "Challenge List",
  unrated: "Unrated List",
  platformer: "Platformer List",
};

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedListType, setSelectedListType] = useState<string>("demonlist");
  
  const { data: records, isLoading: recordsLoading } = useQuery<any[]>({
    queryKey: ["/api/records", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/records/${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch records");
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: verifiedLevels, isLoading: verifiedLoading } = useQuery<any[]>({
    queryKey: ["/api/verified-levels", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/verified-levels/${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch verified levels");
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: userPacks, isLoading: packsLoading } = useQuery<any[]>({
    queryKey: ["/api/packs/user", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/packs/user/${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch packs");
      return response.json();
    },
    enabled: !!user?.id,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-12">
          <div className="container mx-auto px-6">
            <Skeleton className="h-40 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-12 flex items-center justify-center">
          <p className="text-muted-foreground">Please log in to view your profile.</p>
        </main>
      </div>
    );
  }

  const initials = getInitials(user);
  const approvedRecords = records?.filter(r => r.status === "approved" && r.demon?.listType === selectedListType) || [];
  const verifiedInList = verifiedLevels?.filter(l => l.listType === selectedListType) || [];
  const completedPacks = userPacks?.filter(p => p.isCompleted && p.listType === selectedListType) || [];
  
  const allCompletions = approvedRecords.length + verifiedInList.length;
  const completionPoints = approvedRecords.reduce((sum, r) => sum + (r.demon?.points || 0), 0) + verifiedInList.reduce((sum, l) => sum + (l.points || 0), 0);
  const packBonusPoints = completedPacks.reduce((sum, p) => sum + (p.points || 0), 0);
  const totalCompletionPoints = completionPoints + packBonusPoints;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* List Type Filter */}
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              <span className="text-sm font-medium whitespace-nowrap">Filter by:</span>
              <div className="flex gap-2">
                {Object.entries(LIST_NAMES).map(([type, label]) => (
                  <Button
                    key={type}
                    variant={selectedListType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedListType(type)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {/* Profile Header */}
            <Card className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.profileImageUrl || ""} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left">
                  <h1 className="font-display font-bold text-3xl mb-2" data-testid="text-profile-name">
                    {user.username}
                  </h1>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl">
                        {allCompletions}
                      </p>
                      <p className="text-sm text-muted-foreground">Completions</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl">
                        {totalCompletionPoints}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl">
                        {records?.filter(r => r.status === "pending").length || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Approved Completions */}
            <Card className="p-8">
              <h2 className="font-display font-bold text-2xl mb-6">Approved Completions</h2>
              
              {recordsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : approvedRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No approved completions yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {approvedRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`record-item-${record.id}`}
                    >
                      <div>
                        <p className="font-medium" data-testid={`record-name-${record.id}`}>
                          {record.demon?.name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.demon?.difficulty || "Unknown"} • {record.demon?.points || 0} pts
                        </p>
                      </div>
                      <p className="font-display font-bold text-primary">
                        {record.demon?.points || 0}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Verified Levels */}
            <Card className="p-8">
              <h2 className="font-display font-bold text-2xl mb-6">Verified Levels</h2>
              
              {verifiedLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : verifiedInList.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No verified levels in this list yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {verifiedInList?.map((level) => (
                    <div
                      key={level.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`verified-level-${level.id}`}
                    >
                      <div>
                        <p className="font-medium" data-testid={`verified-name-${level.id}`}>
                          #{level.position} {level.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {level.difficulty}
                        </p>
                      </div>
                      <p className="font-display font-bold text-accent">
                        {level.points} pts
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Completed Packs */}
            <Card className="p-8">
              <h2 className="font-display font-bold text-2xl mb-6">Completed Packs</h2>
              
              {packsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : completedPacks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No completed packs in this list yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {completedPacks?.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`pack-item-${pack.id}`}
                    >
                      <div>
                        <p className="font-medium" data-testid={`pack-name-${pack.id}`}>
                          {pack.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pack.levels?.length || 0} levels
                        </p>
                      </div>
                      <p className="font-display font-bold text-green-600 dark:text-green-400">
                        +{pack.points} pts
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
