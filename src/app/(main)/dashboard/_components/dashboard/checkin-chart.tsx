"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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

interface CheckinChartProps {
  records: CheckinRecord[]
}

interface UserStats {
  user_id: string
  user_name: string
  user_avatar: string | null
  checkin_count: number
}

export function CheckinChart({ records }: CheckinChartProps) {
  const userStats: UserStats[] = records.reduce((acc, record) => {
    const existingUser = acc.find((u) => u.user_id === record.user_id)
    if (existingUser) {
      existingUser.checkin_count++
    } else {
      acc.push({
        user_id: record.user_id,
        user_name: record.user_name,
        user_avatar: record.user_avatar,
        checkin_count: 1,
      })
    }
    return acc
  }, [] as UserStats[])

  const sortedStats = userStats.sort((a, b) => b.checkin_count - a.checkin_count)
  const maxCount = Math.max(...sortedStats.map((s) => s.checkin_count), 1)

  return (
    <div className="space-y-4">
      {sortedStats.map((user, index) => (
        <div key={user.user_id} className="flex items-center gap-4">
          <div className="flex items-center gap-3 w-48 flex-shrink-0">
            <span className="text-sm text-muted-foreground w-6">#{index + 1}</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_avatar || "/placeholder.svg"} />
              <AvatarFallback>{user.user_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-medium truncate">{user.user_name}</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(user.checkin_count / maxCount) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm font-medium w-12 text-right">{user.checkin_count}次</span>
          </div>
        </div>
      ))}

      {sortedStats.length === 0 && <div className="text-center py-8 text-muted-foreground">暂无打卡数据</div>}
    </div>
  )
}
