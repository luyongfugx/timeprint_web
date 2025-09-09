import { createClient } from "./supabaseServer"

export async function getSessionUser(request: Request) {
  const supabase = await createClient()
    // Try to get token from Authorization header
    const authHeader = request.headers.get("Authorization")
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")
      const result = await supabase.auth.getUser(token)
      user = result.data.user
      authError = result.error
    } else {
      // Fall back to session cookie
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }
    return {
        user,
        authError
    }
}