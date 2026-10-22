import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { authCookie, createUser } from "./helpers.js";

// Google's token check is replaced: a credential "good:<sub>:<email>" verifies
// (with the profile below), anything else is rejected like a forged token.
const google = vi.hoisted(() => ({ profile: null, verifyIdToken: null }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(function OAuth2Client() {
    return { verifyIdToken: google.verifyIdToken };
  })
}));
vi.mock("../src/services/ai.service.js", () => ({ default: vi.fn(), evaluateAnswer: vi.fn() }));

const { default: app } = await import("../src/app.js");
const { default: userModel } = await import("../src/models/user.model.js");

const CLIENT_ID = "client-id.apps.googleusercontent.com";
const signIn = (credential) => request(app).post("/api/auth/google").send({ credential });
const cookieFrom = (res) => res.headers["set-cookie"]?.find((c) => c.startsWith("token="))?.split(";")[0];

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  google.verifyIdToken = vi.fn(async ({ idToken, audience }) => {
    const [kind, sub, email, verified = "true", name = "Asha Rao"] = idToken.split(":");
    if (kind !== "good" || audience !== CLIENT_ID) throw new Error("Invalid token signature");
    return { getPayload: () => ({ sub, email, email_verified: verified === "true", name }) };
  });
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
});

describe("GET /api/auth/providers", () => {
  it("shares Google's client id when sign-in with Google is on, and null when it's off", async () => {
    expect((await request(app).get("/api/auth/providers")).body).toEqual({ google: CLIENT_ID });
    delete process.env.GOOGLE_CLIENT_ID;
    expect((await request(app).get("/api/auth/providers")).body).toEqual({ google: null });
  });
});

describe("POST /api/auth/google", () => {
  it("creates an account for a new Google user and signs them in", async () => {
    const res = await signIn("good:g-1:Asha@Example.test");

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: "asha_rao", email: "asha@example.test", role: "user", hasPassword: false });
    expect(google.verifyIdToken).toHaveBeenCalledWith({ idToken: "good:g-1:Asha@Example.test", audience: CLIENT_ID });

    const user = await userModel.findOne({ googleId: "g-1" }).lean();
    expect(user.password).toBeUndefined();

    // the cookie is a normal session
    const me = await request(app).get("/api/auth/get-me").set("Cookie", cookieFrom(res));
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: "asha@example.test", hasPassword: false });
  });

  it("signs the same Google user back in without a second account", async () => {
    await signIn("good:g-1:asha@example.test");
    const again = await signIn("good:g-1:asha@example.test");

    expect(again.status).toBe(200);
    expect(await userModel.countDocuments({})).toBe(1);
  });

  it("links Google to an existing password account with the same email, keeping its data", async () => {
    const existing = await createUser({ username: "asha", email: "Asha@example.test" });
    const res = await signIn("good:g-7:asha@example.test");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: String(existing._id), username: "asha", hasPassword: true });
    expect(await userModel.countDocuments({})).toBe(1);
    expect((await userModel.findById(existing._id)).googleId).toBe("g-7");

    // the password still works too
    expect((await request(app).post("/api/auth/login").send({ email: "Asha@example.test", password: "right-password" })).status).toBe(200);
  });

  it("picks a free username when the natural one is taken", async () => {
    await createUser({ username: "asha_rao", email: "other@example.test" });
    const res = await signIn("good:g-2:asha@example.test");
    expect(res.body.user.username).toMatch(/^asha_rao\w+$/);
    expect(res.body.user.username).not.toBe("asha_rao");
  });

  it("rejects a token Google didn't sign, or one meant for another app", async () => {
    expect((await signIn("forged:g-1:asha@example.test")).status).toBe(401);
    process.env.GOOGLE_CLIENT_ID = "someone-elses-app";
    expect((await signIn("good:g-1:asha@example.test")).status).toBe(401);
    expect(await userModel.countDocuments({})).toBe(0);
  });

  it("won't take over an account with an unverified Google email", async () => {
    await createUser({ email: "victim@example.test" });
    const res = await signIn("good:g-9:victim@example.test:false");

    expect(res.status).toBe(401);
    expect(cookieFrom(res)).toBeUndefined();
    expect((await userModel.findOne({ email: "victim@example.test" })).googleId).toBeUndefined();
  });

  it("needs a credential", async () => {
    expect((await request(app).post("/api/auth/google").send({})).status).toBe(400);
    expect((await request(app).post("/api/auth/google").send({ credential: { $ne: "" } })).status).toBe(400);
  });

  it("answers 503 when sign-in with Google isn't set up", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await signIn("good:g-1:asha@example.test");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("GOOGLE_DISABLED");
  });
});

describe("accounts without a password", () => {
  const googleUser = async () => {
    const res = await signIn("good:g-1:asha@example.test");
    return { user: await userModel.findOne({ googleId: "g-1" }), cookie: cookieFrom(res) };
  };

  it("can't sign in with an email and a guessed password", async () => {
    await googleUser();
    const res = await request(app).post("/api/auth/login").send({ email: "asha@example.test", password: "anything-1" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("are pointed to Forgot password instead of Change password", async () => {
    const { cookie } = await googleUser();
    const res = await request(app)
      .patch("/api/auth/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "x", newPassword: "brand-new-9" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NO_PASSWORD");
  });

  it("confirm deleting the account by typing their email", async () => {
    const { user, cookie } = await googleUser();

    const wrong = await request(app).delete("/api/auth/account").set("Cookie", cookie).send({ email: "someone@example.test" });
    expect(wrong.status).toBe(401);
    expect((await request(app).delete("/api/auth/account").set("Cookie", cookie).send({})).status).toBe(400);

    const res = await request(app).delete("/api/auth/account").set("Cookie", cookie).send({ email: " ASHA@example.test " });
    expect(res.status).toBe(200);
    expect(await userModel.exists({ _id: user._id })).toBeNull();
  });

  it("password accounts still confirm deletion with the password, not the email", async () => {
    const user = await createUser({ email: "pw@example.test", password: "right-password" });
    const res = await request(app).delete("/api/auth/account").set("Cookie", authCookie(user)).send({ email: "pw@example.test" });
    expect(res.status).toBe(400);
    expect(await userModel.exists({ _id: user._id })).not.toBeNull();
  });
});
