import mongoose from "mongoose";
import Tricycle from "./tricycleModel";

const reviewSchema = mongoose.Schema({
  rating: {
    type: Number,
    required: [true, "Please enter the rating of the review"],
  },
  comment: {
    type: String,
    required: [true, "Please enter the comment of the review"],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  tricycle: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Tricycle",
  },
}, {
  timestamps: true,
});

const Review = mongoose.model("Review", reviewSchema);

export default Review;
