import { useEffect, useState } from "react";
import { getMe } from "./services/auth.api";
import { AuthContext } from "./auth.context";

export const AuthProvider = ({ children }) => {


  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    const getAndSetUser = async () => {
      const data = await getMe()
      if (data && data.user) {
        setUser(data.user)
      }
      setLoading(false)
    }

    getAndSetUser()
  }, [])


  return (
    <AuthContext.Provider value={{ user, setUser, loading, setLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
