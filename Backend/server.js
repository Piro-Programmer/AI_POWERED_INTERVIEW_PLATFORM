require('dotenv').config()
const app = require('./src/app')
const connectToDB = require('./src/config/database');

connectToDB();

app.listen(3000, () => {
  console.log("Sever is running on port 3000")
})
