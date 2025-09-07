"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

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

interface UserGroupedTableProps {
  records: CheckinRecord[]
}

interface GroupedUser {
  user_id: string
  user_name: string
  user_avatar: string | null
  checkin_count: number
  records: CheckinRecord[]
}

export function UserGroupedTable({ records }: UserGroupedTableProps) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  const groupedUsers: GroupedUser[] = records.reduce((acc, record) => {
    const existingUser = acc.find((u) => u.user_id === record.user_id)
    if (existingUser) {
      existingUser.records.push(record)
      existingUser.checkin_count++
    } else {
      acc.push({
        user_id: record.user_id,
        user_name: record.user_name,
        user_avatar: record.user_avatar,
        checkin_count: 1,
        records: [record],
      })
    }
    return acc
  }, [] as GroupedUser[])

  const toggleExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedUsers(newExpanded)
  }

  return (
    <div className="space-y-2">
      {groupedUsers.map((user) => (
        <Collapsible key={user.user_id} open={expandedUsers.has(user.user_id)}>
          <div className="rounded-md border">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-4 h-auto"
                onClick={() => toggleExpanded(user.user_id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.user_avatar || "/placeholder.svg"} />
                    <AvatarFallback>{user.user_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{user.user_name}</span>
                    <Badge variant="secondary">{user.checkin_count} 次打卡</Badge>
                  </div>
                </div>
                {expandedUsers.has(user.user_id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>打卡时间</TableHead>
                      <TableHead>位置信息</TableHead>
                      <TableHead>照片</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{format(new Date(record.created_at), "yyyy年MM月dd日", { locale: zhCN })}</span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(record.created_at), "HH:mm:ss")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{record.location_name || "未知位置"}</TableCell>
                        <TableCell>
                          <img
                            src={record.photo_url || "/placeholder.svg"}
                            alt="打卡照片"
                            className="h-12 w-12 rounded object-cover"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  )
}
