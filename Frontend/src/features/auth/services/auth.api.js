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

/**
 * Delete the account and all its data. Confirmed with { password }, or with
 * { email } for a Google account that has no password.
 */
export async function deleteAccount(confirmation) {
  const response = await api.delete("/api/auth/account", { data: confirmation });
  return response.data;
}

/** Which sign-in providers are on. Resolves to { google: clientId | null }. */
export async function getProviders() {
  const response = await api.get("/api/auth/providers");
  return response.data;
}

/** Sign in (or sign up) with the ID token from Google's button. Resolves to { user }. */
export async function googleSignIn(credential) {
  const response = await api.post("/api/auth/google", { credential });
  return response.data;
}

/** Ask for a password-reset email. The answer is the same whether or not the account exists. */
export async function forgotPassword(email) {
  const response = await api.post("/api/auth/forgot-password", { email });
  return response.data;
}

/** Set a new password with the token from the reset email. */
export async function resetPassword({ token, password }) {
  const response = await api.post("/api/auth/reset-password", { token, password });
  return response.data;
}
