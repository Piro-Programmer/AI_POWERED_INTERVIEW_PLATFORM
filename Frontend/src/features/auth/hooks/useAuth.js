import { useContext } from "react";
import { AuthContext } from "../auth.context";
import {login, register, logout} from "../services/auth.api"


export const useAuth = () =>{
  const context = useContext(AuthContext)
  const {user,setUser, loading, setLoading} = context


  // Both return { ok: true } or { ok: false, message } so the page can show why
  const errorMessage = (err, fallback) => err?.response?.data?.message || fallback

  const handleLogin = async ({email, password }) =>{
    setLoading(true)

    try{
      const data = await login(email, password)

      if(data && data.user){
        setUser(data.user)
        return { ok: true };
      }else{
        console.log("Login failed: No user data is response")
        return { ok: false, message: "Sign in failed. Please try again." };
      }
    }catch(err){
        console.log(err)
        return { ok: false, message: errorMessage(err, "Couldn't reach the server. Please try again.") };
    }finally{
          setLoading(false)

    }


  }

  const handleRegister = async({ username, email, password })=>{
    setLoading(true)
    try{

      const data = await register({username, email, password})

      if (data && data.user) {
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false, message: "Sign up failed. Please try again." };

    }catch(err){
      console.log("Register Error",err)
      return { ok: false, message: errorMessage(err, "Couldn't reach the server. Please try again.") };
    }finally{
      setLoading(false)
    }
  }

  const handleLogout = async ()=>{
    setLoading(true)
    try{

      await logout()
      setUser(null);

    }catch(err){

      console.log(err)

    }finally{

      setLoading(false)

    }
  }

  return {user, loading, handleRegister, handleLogin,handleLogout }
}
