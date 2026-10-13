import api from "../../../lib/api";

export async function  register({username,email,password}) {
  try{
    const response = await api.post('/api/auth/register',{
    username, email, password
  },)

  return response.data

  } catch (err) {

    console.log("Register Error Details", err.response?.data?.message)
    throw err;

  }

}


export async function login(email,password) {
  try{
    const response = await api.post("/api/auth/login",{
      email,password
    })

    return response.data;

  }catch(err){
    console.log("Login Error Details",err.response?.data?.message)
    throw err;
  }
}

export async function logout(){
  try{
    const response = await api.get("/api/auth/logout")
    return response.data
  }catch(err){
    console.log(err)
  }
}

export async function getMe(){

  try{
    const response = await api.get("/api/auth/get-me")

    return response.data

  }catch(err){
    if(err.response && err.response.status === 401){
      return null;
    }
    console.log("Fetch User Error",err)
    throw err;
  }

}

/** Change the password; other sessions are signed out, this one stays. */
export async function changePassword({ currentPassword, newPassword }) {
  const response = await api.patch("/api/auth/password", { currentPassword, newPassword });
  return response.data;
}

/** Delete the account and all its data. */
export async function deleteAccount(password) {
  const response = await api.delete("/api/auth/account", { data: { password } });
  return response.data;
}
