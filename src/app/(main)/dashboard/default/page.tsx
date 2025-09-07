"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { DateRange } from "react-day-picker"
import { subDays } from "date-fns"
import { useAuth } from "@/hooks/use-auth"
import { useTeam } from "@/hooks/use-team"
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "../_components/dashboard/date-range-picker"
import { StatsCards } from "../_components/dashboard/stats-cards"
import { CheckinTable } from "../_components/dashboard/checkin-table"
import { UserGroupedTable } from "../_components/dashboard/user-grouped-table"
import { CheckinChart } from "../_components/dashboard/checkin-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface CheckinRecord {
  id: string
  user_id: string
  photo_url: string
  latitude: number | null
  longitude: number | null
  location_name: string | null
  created_at: string
  user_name: string
  user_avatar: string | null
}

interface TeamMember {
  user_id: string
  user_name: string
  user_avatar: string | null
}

export default function HomePage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [checkinRecords, setCheckinRecords] = useState<CheckinRecord[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCheckins: 0,
    activeUsers: 0,
    participationRate: 0,
  })
  const [loading, setLoading] = useState(true)

  const { user } = useAuth()
  const { team, userRole } = useTeam()
  const router = useRouter()

  const canDelete = userRole === "creator" || userRole === "admin"

  useEffect(() => {
    if (team) {
      fetchData()
    }
  }, [team, date, selectedUser])

  const fetchData = async () => {
    if (!team) return

    setLoading(true)
    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (date?.from) params.append("dateFrom", date.from.toISOString())
      if (date?.to) params.append("dateTo", date.to.toISOString())
      if (selectedUser !== "all") params.append("userId", selectedUser)

      // Fetch check-in records
      const recordsResponse = await fetch(`/api/checkins?${params}`)
      const recordsData = await recordsResponse.json()

      if (!recordsResponse.ok) {
        throw new Error(recordsData.error || "Failed to fetch records")
      }

      setCheckinRecords(recordsData.records)

      // Fetch stats and team members
      const statsResponse = await fetch(`/api/checkins/stats?${params}`)
      const statsData = await statsResponse.json()

      if (!statsResponse.ok) {
        throw new Error(statsData.error || "Failed to fetch stats")
      }

      setStats(statsData.stats)
      setTeamMembers(statsData.teamMembers)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCheckin = async (checkinId: string) => {
    try {
      const response = await fetch(`/api/checkins/${checkinId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete check-in")
      }

      fetchData()
    } catch (error) {
      console.error("Error deleting check-in:", error)
    }
  }
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">欢迎使用打卡系统</h1>
          <p className="text-muted-foreground">您还没有加入任何团队，请先创建或加入一个团队</p>
        </div>
        <Button onClick={() => router.push("/dashboard/create-team")}>
          创建团队
        </Button>
      </div>
    )
  }
  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>

    )
  }

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">打卡数据概览</h1>
          <p className="text-muted-foreground">查看团队成员的打卡统计和详细记录</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
            <CardDescription>选择时间范围和用户来查看特定的打卡数据</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <DatePickerWithRange date={date} setDate={setDate} />
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有用户</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <StatsCards
          totalUsers={stats.totalUsers}
          totalCheckins={stats.totalCheckins}
          activeUsers={stats.activeUsers}
          participationRate={stats.participationRate}
        />

        <Card>
          <CardHeader>
            <CardTitle>打卡记录</CardTitle>
            <CardDescription>以不同方式查看团队打卡数据</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table" className="space-y-4">
              <TabsList>
                <TabsTrigger value="table">全部记录</TabsTrigger>
                <TabsTrigger value="grouped">按用户分组</TabsTrigger>
                <TabsTrigger value="chart">统计图表</TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="space-y-4">
                <CheckinTable records={checkinRecords} onDelete={handleDeleteCheckin} canDelete={canDelete} />
              </TabsContent>

              <TabsContent value="grouped" className="space-y-4">
                <UserGroupedTable records={checkinRecords} />
              </TabsContent>

              <TabsContent value="chart" className="space-y-4">
                <CheckinChart records={checkinRecords} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
  )
}
