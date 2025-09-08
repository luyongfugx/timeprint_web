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

    // Check if user is member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", awaitedParams.teamId)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { name, address, description } = await request.json()
    const supabase = await createClient()
    const awaitedParams = await params

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user can edit team (creator or admin)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", awaitedParams.teamId)
      .single()

    if (!membership || (membership.role !== "creator" && membership.role !== "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: team, error } = await supabase
      .from("teams")
      .update({
        name,
        address: address || null,
        description: description || null,
      })
      .eq("id", awaitedParams.teamId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ team })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
