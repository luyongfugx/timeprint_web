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

    // Get today's date range (start and end of day)
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()

    // 1. Get total team members count
    const { count: totalMembers, error: countError } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 })
    }
    // CREATE TABLE IF NOT EXISTS photo_checkins (
    //     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    //     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    //     team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    //     photo_url TEXT NOT NULL,
    //     latitude DECIMAL(10, 8),
    //     longitude DECIMAL(11, 8),
    //     location_name TEXT,
    //     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    //   );
    // 2. Get today's check-ins
    const { data: todayCheckins, error: checkinError } = await supabase
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
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false })

    if (checkinError) {
      return NextResponse.json({ error: checkinError.message }, { status: 400 })
    }

    // 3. Calculate statistics
    const todayCheckinCount = todayCheckins?.length || 0
    const uniqueCheckinUsers = new Set(todayCheckins?.map(checkin => checkin.user_id)).size
    const todayCheckinPhotos = todayCheckins
      ?.filter(checkin => checkin.photo_url)
      .map(checkin => checkin.photo_url)
      .filter(Boolean) || []

    // 4. Get user information for all check-in users
    const userIds = todayCheckins?.map(checkin => checkin.user_id).filter(Boolean) || []
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
    const formattedCheckins = todayCheckins?.map(checkin => {
      const user = usersData.find(u => u.id === checkin.user_id)
      return {
        id: checkin.id,
        user_id: checkin.user_id,
        created_at: checkin.created_at,
        image_url: checkin.photo_url,
        location: checkin.location_name,
        user_name: user?.user_metadata?.full_name || "未知用户",
        user_email: user?.email || "",
        user_avatar: user?.user_metadata?.avatar_url || null
      }
    }) || []
    var resultJson = {
      team: teamMember.teams,
      statistics: {
        total_members: totalMembers || 0,
        today_checkin_count: todayCheckinCount,
        today_checkin_users: uniqueCheckinUsers,
        today_checkin_photos: todayCheckinPhotos
      },
      today_checkins: formattedCheckins
    }
    console.log("resultJson",resultJson)
    return NextResponse.json(resultJson)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}