import mongoose from 'mongoose';

const forumPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Forum post cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

const ForumPost = mongoose.model('ForumPost', forumPostSchema);

export default ForumPost;
