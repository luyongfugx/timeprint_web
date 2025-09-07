import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { name, address, description } = await request.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name,
        address: address || null,
        description: description || null,
      })
      .select()
      .single()

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 400 })
    }

    // Add user as team creator
    const { error: memberError } = await supabase.from("team_members").insert({
      user_id: user.id,
      team_id: team.id,
      role: "creator",
    })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 400 })
    }

    return NextResponse.json({ team })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
