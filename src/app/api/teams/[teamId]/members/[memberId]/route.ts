import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
  try {
    const { role } = await request.json()
    const supabase = await createClient()
    const awaitedParams = await params

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is team creator (only creators can change roles)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", awaitedParams.teamId)
      .single()

    if (!membership || membership.role !== "creator") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Validate role
    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Update member role
    const { error } = await supabase.from("team_members").update({ role }).eq("id", awaitedParams.memberId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ teamId: string; memberId: string }> }) {
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
    
    // Check if user is team creator (only creators can remove members)
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", awaitedParams.teamId)
      .single()

    if (!membership || membership.role !== "creator") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if trying to remove creator (not allowed)
    const { data: targetMember } = await supabase.from("team_members").select("role").eq("id", awaitedParams.memberId).single()

    if (targetMember?.role === "creator") {
      return NextResponse.json({ error: "Cannot remove team creator" }, { status: 400 })
    }

    // Remove member
    const { error } = await supabase.from("team_members").delete().eq("id", awaitedParams.memberId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
