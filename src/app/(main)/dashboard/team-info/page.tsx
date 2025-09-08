"use client"

import { useState, useEffect } from "react"
import { useTeam } from "@/hooks/use-team"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Edit, Save, X, Building2, MapPin, FileText, Calendar, Users } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"

interface TeamInfo {
  id: string
  name: string
  address: string | null
  description: string | null
  created_at: string
  member_count: number
}

export default function TeamInfoPage() {
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    description: "",
  })
  const { user } = useAuth()
  const { team, userRole, refreshTeam } = useTeam()
  const { toast } = useToast()

  const canEdit = userRole === "creator" || userRole === "admin"

  useEffect(() => {
    if (team) {
      fetchTeamInfo()
    }
  }, [team])

  const fetchTeamInfo = async () => {
    if (!team) return

    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch team info")
      }

      setTeamInfo(data.team)
      setFormData({
        name: data.team.name,
        address: data.team.address || "",
        description: data.team.description || "",
      })
    } catch (error) {
      console.error("Error fetching team info:", error)
      toast({
        title: "错误",
        description: "获取团队信息失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!team || !canEdit) return

    setSaving(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address || null,
          description: formData.description || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update team")
      }

      await refreshTeam()
      await fetchTeamInfo()
      setIsEditing(false)

      toast({
        title: "成功",
        description: "团队信息已更新",
      })
    } catch (error) {
      console.error("Error updating team:", error)
      toast({
        title: "错误",
        description: "更新团队信息失败",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (teamInfo) {
      setFormData({
        name: teamInfo.name,
        address: teamInfo.address || "",
        description: teamInfo.description || "",
      })
    }
    setIsEditing(false)
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

  if (!teamInfo) {
    return (

        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-muted-foreground">未找到团队信息</p>
          </div>
        </div>
    
    )
  }



  return (

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">团队信息</h1>
            <p className="text-muted-foreground">查看和管理团队基本信息</p>
          </div>
          {canEdit && !isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑信息
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "保存中..." : "保存"}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                取消
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                基本信息
              </CardTitle>
              <CardDescription>团队的基本信息和设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">团队名称</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="输入团队名称"
                  />
                ) : (
                  <p className="text-sm font-medium">{teamInfo.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">团队地址</Label>
                {isEditing ? (
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="输入团队地址"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">{teamInfo.address || "未设置地址"}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">团队简介</Label>
                {isEditing ? (
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="输入团队简介"
                    rows={4}
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm">{teamInfo.description || "未设置团队简介"}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                团队统计
              </CardTitle>
              <CardDescription>团队的基本统计信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">成员数量</span>
                <Badge variant="secondary">{teamInfo.member_count} 人</Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">创建时间</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(teamInfo.created_at), "yyyy年MM月dd日", { locale: zhCN })}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">您的角色</span>
                <Badge variant={userRole === "creator" ? "default" : userRole === "admin" ? "secondary" : "outline"}>
                  {userRole === "creator" ? "创建者" : userRole === "admin" ? "管理员" : "普通成员"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {!canEdit && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>只有团队创建者和管理员可以编辑团队信息</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

  )
}
