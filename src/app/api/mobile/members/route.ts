import { getSessionUser } from "@/lib/requestUtil"
import { createClient } from "@/lib/supabaseServer"
import { NextResponse } from "next/server"
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const sessionUser = await getSessionUser(request)
    let user = sessionUser.user
    let authError = sessionUser.authError
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's team membership
    const { data: teamMember, error: teamError } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .single()

    if (teamError || !teamMember) {
      return NextResponse.json({ error: "No team found" }, { status: 404 })
    }

    const teamId = teamMember.team_id


    // 2. Get  members
    const { data: members, error: checkinError } = await supabase
      .from("team_members")
      .select(`
        id,
        user_id,
        team_id
      `)
      .eq("team_id", teamId)

    if (checkinError) {
        console.log(checkinError)
        return NextResponse.json({ error: checkinError.message }, { status: 400 })
    }

   

    // 4. Get user information for all members
    const userIds = members?.map(member => member.user_id).filter(Boolean) || []
    let usersData: Array<{ id: string; email: string; user_metadata: any }> = []
    
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("app_users")
        .select("id, email, user_metadata")
        .in("id", userIds)

      if (!usersError) {
        usersData = users || []
      }
    }

    // 5. Format checkin records with user info
    const formattedMembers = members?.map(member => {
      const user = usersData.find(u => u.id === member.user_id)
      return {
        id: member.id,
        user_id: member.user_id,
        user_name: user?.user_metadata?.full_name || "",
        user_email: user?.email || "",
        user_avatar: user?.user_metadata?.avatar_url || null
      }
    }) || []
    var resultJson = formattedMembers

    console.log("formattedMembers resultJson",resultJson)
    return NextResponse.json(resultJson)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}