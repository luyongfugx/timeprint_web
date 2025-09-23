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
      .select("team_id, role, teams(*)")
      .eq("user_id", user.id)
      .single()

    if (teamError || !teamMember) {
      return NextResponse.json({ error: "No team found" }, { status: 404 })
    }

    const teamId = teamMember.team_id


    // 2. Get  check-ins
    const { data: checkins, error: checkinError } = await supabase
      .from("photo_checkins")
      .select(`
        id,
        user_id,
        created_at,
        photo_url,
        latitude,
        longitude,
        location_name
      `)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (checkinError) {
      return NextResponse.json({ error: checkinError.message }, { status: 400 })
    }

   

    // 4. Get user information for all check-in users
    const userIds = checkins?.map(checkin => checkin.user_id).filter(Boolean) || []
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
    const formattedCheckins = checkins?.map(checkin => {
      const user = usersData.find(u => u.id === checkin.user_id)
      return {
        id: checkin.id,
        user_id: checkin.user_id,
        created_at: Math.floor(new Date(checkin.created_at).getTime()),
        image_url: checkin.photo_url,
        location: checkin.location_name,
        user_name: user?.user_metadata?.full_name || "",
        user_email: user?.email || "",
        user_avatar: user?.user_metadata?.avatar_url || null
      }
    }) || []
    var resultJson = {
      team: teamMember.teams,
      today_checkins: formattedCheckins
    }
    console.log("resultJson",resultJson)
    return NextResponse.json(resultJson)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}