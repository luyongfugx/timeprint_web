"use client"

import { useState } from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trash2, MapPin, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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

interface CheckinTableProps {
  records: CheckinRecord[]
  onDelete: (id: string) => void
  canDelete: boolean
}

export function CheckinTable({ records, onDelete, canDelete }: CheckinTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 10
  const totalPages = Math.ceil(records.length / recordsPerPage)

  const paginatedRecords = records.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage)

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>打卡时间</TableHead>
              <TableHead>位置信息</TableHead>
              <TableHead>照片</TableHead>
              {canDelete && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={record.user_avatar || "/placeholder.svg"} />
                      <AvatarFallback>{record.user_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{record.user_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{format(new Date(record.created_at), "yyyy年MM月dd日", { locale: zhCN })}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(record.created_at), "HH:mm:ss")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {record.location_name ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{record.location_name}</span>
                    </div>
                  ) : (
                    <Badge variant="secondary">未知位置</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        查看
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>打卡照片</DialogTitle>
                      </DialogHeader>
                      <div className="flex justify-center">
                        <img
                          src={record.photo_url || "/placeholder.svg"}
                          alt="打卡照片"
                          className="max-w-full h-auto rounded-lg"
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
                {canDelete && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(record.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            显示 {(currentPage - 1) * recordsPerPage + 1} 到 {Math.min(currentPage * recordsPerPage, records.length)}{" "}
            条，共 {records.length} 条记录
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              上一页
            </Button>
            <span className="text-sm">
              第 {currentPage} 页，共 {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
