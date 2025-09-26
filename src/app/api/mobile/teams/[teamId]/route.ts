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
    // Get team info
    const { data: team, error: teamError } = await supabase.from("teams").select("*").eq("id", awaitedParams.teamId).single()
    if (teamError) {
      return NextResponse.json( {
        status:400,
        msg:teamError.message,
        data: {}
      })
    }

    // Get member count
    const { count: memberCount, error: countError } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", awaitedParams.teamId)
    if (countError) {
      return NextResponse.json( {
        status:400,
        msg:countError.message,
        data: {}
      })
    }
    return NextResponse.json( {
      status:200,
      msg:"succ",
      data: {
        ...team,
        member_count: memberCount || 0,
      }
    })
  } catch (error) {
    return NextResponse.json( {
      status:400,
      msg:error,
      data: {}
    })
  }
}