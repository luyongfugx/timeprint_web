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
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get("user_id")

  
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
      .eq("user_id", queryUserId)
      .order("created_at", { ascending: false })

    if (checkinError) {
      return NextResponse.json({ error: checkinError.message }, { status: 400 })
    }



    const userIds =  [queryUserId]
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
        created_at: Math.floor(new Date(checkin.created_at).getTime()),
        image_url: checkin.photo_url,
        location: checkin.location_name,
        user_name: user?.user_metadata?.full_name || "未知用户",
        user_email: user?.email || "",
        user_avatar: user?.user_metadata?.avatar_url || null
      }
    }) || []
    var userInfo  =usersData[0]
    var resultJson = {
      checkins:
      formattedCheckins,
      user: { 
        user_id: userInfo.id,
        user_name: userInfo.user_metadata?.full_name || "未知用户",
        user_email: userInfo.email || "",
        user_avatar: userInfo.user_metadata?.avatar_url || null
      }
    } 
    console.log("resultJson:",resultJson)
    return NextResponse.json(resultJson)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}