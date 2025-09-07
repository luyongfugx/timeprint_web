"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Camera, TrendingUp, Clock } from "lucide-react"

interface StatsCardsProps {
  totalUsers: number
  totalCheckins: number
  activeUsers: number
  participationRate: number
}

export function StatsCards({ totalUsers, totalCheckins, activeUsers, participationRate }: StatsCardsProps) {
  const stats = [
    {
      title: "团队总人数",
      value: totalUsers,
      icon: Users,
      description: "当前团队成员数量",
    },
    {
      title: "打卡总次数",
      value: totalCheckins,
      icon: Camera,
      description: "选定时间内的打卡次数",
    },
    {
      title: "打卡人数",
      value: activeUsers,
      icon: Clock,
      description: "选定时间内有打卡的人数",
    },
    {
      title: "参与率",
      value: `${participationRate}%`,
      icon: TrendingUp,
      description: "打卡人数占总人数的比例",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
