import "dotenv/config"
import app from "./src/app.js";
import connectToDB from "./src/config/database.js";

const PORT = process.env.PORT || 3000;

// Only accept traffic once the database is reachable; otherwise exit so the
// host marks the deploy as failed instead of serving a broken backend.
try {
  await connectToDB();
} catch (err) {
  console.error("Could not connect to the database:", err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
