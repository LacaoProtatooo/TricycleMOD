import { connectDB } from "../config/db.js";
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();
const PORT = process.env.PORT || 5000;

console.log("MongoDB URI:", process.env.MONGO_URI);
app.listen(PORT, () => {
    connectDB();
    console.log("Server Started at http://localhost:" + PORT);
});
