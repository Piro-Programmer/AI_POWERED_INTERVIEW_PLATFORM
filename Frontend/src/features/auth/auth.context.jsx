import { useEffect, useState } from "react";
import { getMe } from "./services/auth.api";
import { AuthContext } from "./auth.context";

export const AuthProvider = ({ children }) => {


  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    const getAndSetUser = async () => {
      try {
        const data = await getMe()
        if (data && data.user) {
          setUser(data.user)
        }
      } catch {
        // API unreachable: treat as signed out so public pages still work
      } finally {
        setLoading(false)
      }
    }

    getAndSetUser()
  }, [])


  return (
    <AuthContext.Provider value={{ user, setUser, loading, setLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
