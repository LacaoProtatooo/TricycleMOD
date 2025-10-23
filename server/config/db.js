import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: "TMOD" });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`); // Add this line
    } catch (error) {
        console.error(`Error: ${error.message}`)
        process.exit(1); // 1 means failure, 0 means success
    }
    
}