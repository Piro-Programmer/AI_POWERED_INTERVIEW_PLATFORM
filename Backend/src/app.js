import express from "express";
import authRouter from "./routes/auth.routes.js";
import interviewRouter from "./routes/interview.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

export default app;



// Server Initiated here and instance creation
// middlewares aur jo bhi ham routes create krte h un sabko use krna

// const express = require("express");
// const authRouter = require("./routes/auth.routes")
// const interviewRouter = require("./routes/interview.routes")
// const cookieParser = require("cookie-parser")
// const cors = require("cors")

// const app = express();
// app.use(express.json())
// app.use(cookieParser())

// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true
// }))


// app.use("/api/auth",authRouter)
// app.use("/api/interview", interviewRouter)


// export default app;
