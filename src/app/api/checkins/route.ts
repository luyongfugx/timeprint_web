import { createClient } from "@/lib/supabaseServer"
import { type NextRequest, NextResponse } from "next/server"
import { addDays } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's team
    const { data: teamMember } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).single()

    if (!teamMember) {
      return NextResponse.json({ error: "User not in any team" }, { status: 400 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const userId = searchParams.get("userId")

    // Build query
    let query = supabase
      .from("photo_checkins")
      .select(`
        id,
        user_id,
        photo_url,
        latitude,
        longitude,
        location_name,
        created_at
      `)
      .eq("team_id", teamMember.team_id)
      .order("created_at", { ascending: false })

    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString())
    }
    if (dateTo) {
      query = query.lte("created_at", addDays(new Date(dateTo), 1).toISOString())
    }
    if (userId && userId !== "all") {
      query = query.eq("user_id", userId)
    }

    const { data: records, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const checkinData =
      records?.map((record) => ({
        id: record.id,
        user_id: record.user_id,
        photo_url: record.photo_url,
        latitude: record.latitude,
        longitude: record.longitude,
        location_name: record.location_name,
        created_at: record.created_at,
        // user_name: record.profiles?.full_name || "未知用户",
        // user_avatar: record.profiles?.avatar_url || null,
      })) || []

    return NextResponse.json({ records: checkinData })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { photo_url, latitude, longitude, location_name } = await request.json()
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's team
    const { data: teamMember } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).single()

    if (!teamMember) {
      return NextResponse.json({ error: "User not in any team" }, { status: 400 })
    }

    // Create check-in record
    const { data: checkin, error } = await supabase
      .from("photo_checkins")
      .insert({
        user_id: user.id,
        team_id: teamMember.team_id,
        photo_url,
        latitude: latitude || null,
        longitude: longitude || null,
        location_name: location_name || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ checkin })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
