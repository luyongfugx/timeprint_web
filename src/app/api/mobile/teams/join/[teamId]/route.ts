import { getSessionUser } from "@/lib/requestUtil"
import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const supabase = await createClient()
    const sessionUser = await getSessionUser(request)
    let user = sessionUser.user
    const awaitedParams = await params

    if (!user) {
      return NextResponse.json(
        {
          status:401,
          msg:"Unauthorized",
          data: {}
        })
    }

    // Check if user is member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("team_id", awaitedParams.teamId)
      .single()

    if (membership) {
      return NextResponse.json( {
        status:403,
        msg:"Access denied",
        data: {}
      })
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
      return NextResponse.json( {
        status:200,
        msg:"succ",
        data:newMembership
      })
  } catch (error) {
    return NextResponse.json( {
      status:500,
      msg:"Internal server error",
      data: {}
    })
  }
}
