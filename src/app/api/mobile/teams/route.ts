import { getSessionUser } from "@/lib/requestUtil"
import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { name, address, description } = await request.json()
    const supabase = await createClient()
    const sessionUser = await getSessionUser(request)
    let user = sessionUser.user
    if (!user) {
      return NextResponse.json(
        {
          status:401,
          msg:"Unauthorized",
          data: {}
        })
    }
    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name,
        address: address || null,
        description: description || null,
        user_id: user.id, 
      })
      .select()
      .single()

    if (teamError) {
      return NextResponse.json(
        {
          status:400,
          msg:teamError.message,
          data: {}
        })
    }

    // Add user as team creator
    const { error: memberError } = await supabase.from("team_members").insert({
      user_id: user.id,
      team_id: team.id,
      role: "creator",
    })

    if (memberError) {
      return NextResponse.json(
        {
          status:400,
          error: memberError.message ,
          data: {}
        })
    }

    return NextResponse.json(
      {
        status:200,
        error: "succ",
        data: team
      })
  } catch (error) {
    return NextResponse.json(
      {
        status:500,
        error: "Internal server error" ,
        data: {}
      })

  }
}
