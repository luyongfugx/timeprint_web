import { getSessionUser } from "@/lib/requestUtil"
import { createClient } from "@/lib/supabaseServer"
import { NextRequest, NextResponse } from "next/server"
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const sessionUser = await getSessionUser(request)
    let user = sessionUser.user
    let authError = sessionUser.authError
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const dataJson = await request.json()
    const { data: photo_checkins, error: teamError } = await supabase
    .from("photo_checkins")
    .insert({
      user_id: user.id, 
      team_id: dataJson.team_id || null,
      photo_url: dataJson.photo_url || null,
      latitude: dataJson.latitude || null,
      longitude: dataJson.longitude || null,
      location_name: dataJson.location_name || null
    })
    .select()
    .single()
    return NextResponse.json({ photo_checkins })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
