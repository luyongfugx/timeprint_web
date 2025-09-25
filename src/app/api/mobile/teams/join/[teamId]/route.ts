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

    if (membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const { data: newMembership, error: insertError } = await supabase
      .from("team_members")
      .insert({
        user_id: user.id,
        team_id: awaitedParams.teamId,
        role: 'member'
      })
      .select()
      .single()

    return NextResponse.json(newMembership)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
