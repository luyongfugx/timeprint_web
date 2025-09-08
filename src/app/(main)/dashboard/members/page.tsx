"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useTeam } from "@/hooks/use-team"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, UserPlus, Copy, MoreHorizontal, Shield, User, Trash2, Crown } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface TeamMember {
  id: string
  user_id: string
  team_id: string
  role: "creator" | "admin" | "member"
  joined_at: string
  user_name: string
  user_email: string
  user_avatar: string | null
}

export default function MembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const { user } = useAuth()
  const { team, userRole } = useTeam()
  const { toast } = useToast()

  const canManageMembers = userRole === "creator" || userRole === "admin"

  useEffect(() => {
    if (team && canManageMembers) {
      fetchMembers()
    }
  }, [team, canManageMembers])

  useEffect(() => {
    filterMembers()
  }, [members, searchTerm, roleFilter])

  const fetchMembers = async () => {
    if (!team) return

    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}/members`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch members")
      }

      setMembers(data.members)
    } catch (error) {
      console.error("Error fetching members:", error)
      toast({
        title: "错误",
        description: "获取成员列表失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterMembers = () => {
    let filtered = members

    if (searchTerm) {
      filtered = filtered.filter(
        (member) =>
          member.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.user_email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((member) => member.role === roleFilter)
    }

    setFilteredMembers(filtered)
  }

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    if (!team) return

    try {
      const response = await fetch(`/api/teams/${team.id}/members/${memberId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role")
      }

      await fetchMembers()
      toast({
        title: "成功",
        description: "成员角色已更新",
      })
    } catch (error) {
      console.error("Error updating role:", error)
      toast({
        title: "错误",
        description: "更新成员角色失败",
        variant: "destructive",
      })
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!team) return
    if (!confirm(`确定要移除成员 "${memberName}" 吗？`)) return

    try {
      const response = await fetch(`/api/teams/${team.id}/members/${memberId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove member")
      }

      await fetchMembers()
      toast({
        title: "成功",
        description: `已移除成员 ${memberName}`,
      })
    } catch (error) {
      console.error("Error removing member:", error)
      toast({
        title: "错误",
        description: "移除成员失败",
        variant: "destructive",
      })
    }
  }

  const handleCopyInvite = async () => {
    if (!team || !user) return

    const inviteText = `${user.user_metadata?.full_name || user.email} 邀请您加入 ${team.name} 团队的水印照片打卡系统。请点击链接加入：${window.location.origin}`

    try {
      await navigator.clipboard.writeText(inviteText)
      toast({
        title: "成功",
        description: "邀请链接已复制到剪贴板",
      })
      setInviteDialogOpen(false)
    } catch (error) {
      console.error("Error copying to clipboard:", error)
      toast({
        title: "错误",
        description: "复制失败，请手动复制",
        variant: "destructive",
      })
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "creator":
        return <Crown className="h-4 w-4" />
      case "admin":
        return <Shield className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case "creator":
        return "创建者"
      case "admin":
        return "管理员"
      default:
        return "普通成员"
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "creator":
        return "default" as const
      case "admin":
        return "secondary" as const
      default:
        return "outline" as const
    }
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
  if (!canManageMembers) {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">访问受限</h2>
            <p className="text-muted-foreground">只有团队创建者和管理员可以查看成员管理页面</p>
          </div>
        </div>
    )
  }

  return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">成员管理</h1>
            <p className="text-muted-foreground">管理团队成员和权限设置</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                邀请成员
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>邀请新成员</DialogTitle>
                <DialogDescription>复制下面的邀请信息发送给新成员</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    {user?.user_metadata?.full_name || user?.email} 邀请您加入 {team?.name} 团队的水印照片打卡系统。
                    请点击链接加入：{window.location.origin}
                  </p>
                </div>
                <Button onClick={handleCopyInvite} className="w-full">
                  <Copy className="mr-2 h-4 w-4" />
                  复制邀请信息
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
            <CardDescription>搜索和筛选团队成员</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索成员姓名或邮箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="筛选角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有角色</SelectItem>
                  <SelectItem value="creator">创建者</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="member">普通成员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>团队成员 ({filteredMembers.length})</CardTitle>
            <CardDescription>管理团队成员的角色和权限</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>加入时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.user_avatar || "/placeholder.svg"} />
                            <AvatarFallback>{member.user_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{member.user_name}</span>
                            <span className="text-sm text-muted-foreground">{member.user_email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1 w-fit">
                          {getRoleIcon(member.role)}
                          {getRoleText(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(member.joined_at), "yyyy年MM月dd日", { locale: zhCN })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {member.role !== "creator" && userRole === "creator" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>管理成员</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {member.role === "member" && (
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, "admin")}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  设为管理员
                                </DropdownMenuItem>
                              )}
                              {member.role === "admin" && (
                                <DropdownMenuItem onClick={() => handleRoleChange(member.id, "member")}>
                                  <User className="mr-2 h-4 w-4" />
                                  设为普通成员
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveMember(member.id, member.user_name)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                移除成员
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {member.user_id === user?.id && (
                          <Badge variant="outline" className="text-xs">
                            当前用户
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || roleFilter !== "all" ? "没有找到匹配的成员" : "暂无团队成员"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
