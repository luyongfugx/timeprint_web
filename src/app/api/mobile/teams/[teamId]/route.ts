import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    const awaitedParams = await params
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Get team info
    const { data: team, error: teamError } = await supabase.from("teams").select("*").eq("id", awaitedParams.teamId).single()
    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 400 })
    }

    // Get member count
    const { count: memberCount, error: countError } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", awaitedParams.teamId)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 })
    }

    return NextResponse.json({
      team: {
        ...team,
        member_count: memberCount || 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}