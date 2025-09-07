import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"
import { addDays } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's team
    const { data: teamMember } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).single()

    if (!teamMember) {
      return NextResponse.json({ error: "User not in any team" }, { status: 400 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const userId = searchParams.get("userId")

    // Get team members
    const { data: members } = await supabase
      .from("team_members")
      .select(`
        user_id,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq("team_id", teamMember.team_id)

    const teamMembers =
      members?.map((member) => ({
        user_id: member.user_id,
        user_name: member.profiles?.full_name || "未知用户",
        user_avatar: member.profiles?.avatar_url || null,
      })) || []

    // Build check-in query
    let checkinQuery = supabase.from("photo_checkins").select("user_id").eq("team_id", teamMember.team_id)

    if (dateFrom) {
      checkinQuery = checkinQuery.gte("created_at", new Date(dateFrom).toISOString())
    }
    if (dateTo) {
      checkinQuery = checkinQuery.lte("created_at", addDays(new Date(dateTo), 1).toISOString())
    }
    if (userId && userId !== "all") {
      checkinQuery = checkinQuery.eq("user_id", userId)
    }

    const { data: checkins } = await checkinQuery

    const totalUsers = teamMembers.length
    const totalCheckins = checkins?.length || 0
    const activeUsers = new Set(checkins?.map((c) => c.user_id)).size
    const participationRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0

    return NextResponse.json({
      stats: {
        totalUsers,
        totalCheckins,
        activeUsers,
        participationRate,
      },
      teamMembers,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
