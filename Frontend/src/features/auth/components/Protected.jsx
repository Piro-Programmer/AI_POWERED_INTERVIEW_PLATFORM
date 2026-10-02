import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from "react";


const Protected = ({ children }) => {
  const { loading, user } = useAuth()

  if (loading) {
    return (<main className="page-loading">opening your desk…</main>)
  }

  if (!user) {
    return <Navigate to={'/login'} />
  }

  return children
}

export default Protected
