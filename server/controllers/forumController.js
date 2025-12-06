import ForumPost from '../models/forumPostModel.js';

export const createForumPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const post = await ForumPost.create({
      author: userId,
      content: content.trim(),
    });

    await post.populate('author', 'firstname lastname role username image');

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (error) {
    console.error('Error creating forum post:', error);
    res.status(500).json({ success: false, message: 'Failed to create forum post' });
  }
};

export const getForumPosts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);

    const posts = await ForumPost.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', 'firstname lastname role username image');

    res.status(200).json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.error('Error fetching forum posts:', error);
    res.status(500).json({ success: false, message: 'Failed to load forum posts' });
  }
};
