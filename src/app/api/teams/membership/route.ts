import { createClient } from "@/lib/supabaseServer"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: teamMember, error } = await supabase
      .from("team_members")
      .select("team_id, role, teams(*)")
      .eq("user_id", user.id)
      .single()

    if (error) {
      return NextResponse.json({ teamMember: null })
    }

    return NextResponse.json({ teamMember })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
