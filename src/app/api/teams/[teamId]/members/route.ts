import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { teamId: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user can manage members (creator or admin)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", params.teamId)
      .single()

    if (!membership || (membership.role !== "creator" && membership.role !== "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get team members with profile information
    const { data, error } = await supabase
      .from("team_members")
      .select(`
        id,
        user_id,
        team_id,
        role,
        joined_at,
        profiles:user_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("team_id", params.teamId)
      .order("joined_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const members =
      data?.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        team_id: member.team_id,
        role: member.role,
        joined_at: member.joined_at,
        user_name: member.profiles?.full_name || "未知用户",
        user_email: member.profiles?.email || "",
        user_avatar: member.profiles?.avatar_url || null,
      })) || []

    return NextResponse.json({ members })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
