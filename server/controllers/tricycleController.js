import mongoose from "mongoose";
import Tricycle from "../models/tricycleModel.js";
import User from "../models/userModel.js";
import cloudinary from "../utils/cloudinaryConfig.js";

// Cloudinary upload function 
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "tricycles" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// ==================== GET ALL TRICYCLES ====================
export const getTricycles = async (req, res) => {
  try {
    const { search, status } = req.query;

    const query = {};
    if (search) query.plateNumber = { $regex: search, $options: "i" };
    if (status) query.status = status;

    // If user is authenticated and is an operator, only show their tricycles
    if (req.user && req.user.role === 'operator') {
      query.operator = req.user.id;
    }

    const tricycles = await Tricycle.find(query)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    res.status(200).json({
      success: true,
      count: tricycles.length,
      data: tricycles,
    });
  } catch (error) {
    console.error("Error fetching tricycles:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== GET SINGLE TRICYCLE ====================
export const getTricycle = async (req, res) => {
  const { id } = req.params;

  try {
    const tricycle = await Tricycle.findById(id)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    if (!tricycle)
      return res.status(404).json({ success: false, message: "Tricycle not found" });

    res.status(200).json({ success: true, data: tricycle });
  } catch (error) {
    console.error("Error fetching tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== CREATE TRICYCLE ====================
export const createTricycle = async (req, res) => {
  try {
    const { plateNumber, model, driver, status } = req.body;

    // Validate required fields
    if (!plateNumber || !model) {
      return res.status(400).json({
        success: false,
        message: "Plate number and model are required.",
      });
    }

    // Get operator from authenticated user (if available) or from request body
    const operatorId = req.user?.id || req.body.operator;
    
    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: "Operator is required. Please login or provide operator ID.",
      });
    }

    // Validate operator existence and role
    const operatorExists = await User.findById(operatorId);
    if (!operatorExists) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    // If user is authenticated, verify they are an operator
    if (req.user && req.user.role !== 'operator') {
      return res.status(403).json({
        success: false,
        message: "Only operators can create tricycles",
      });
    }

    // Upload multiple images to Cloudinary
    let imageLinks = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer);
          imageLinks.push({ public_id: result.public_id, url: result.secure_url });
        } catch (error) {
          console.error("Cloudinary upload error:", error.message);
          return res.status(500).json({
            success: false,
            message: "Image upload failed. Please try again.",
          });
        }
      }
    }

    // Create new tricycle
    const newTricycle = new Tricycle({
      plateNumber,
      model,
      operator: operatorId,
      driver: driver || null,
      status: status || "unavailable",
      images: imageLinks,
    });

    await newTricycle.save();

    // Populate operator and driver before returning
    const populatedTricycle = await Tricycle.findById(newTricycle._id)
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    res.status(201).json({
      success: true,
      message: "Tricycle added successfully",
      data: populatedTricycle,
    });
  } catch (error) {
    console.error("Error creating tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== UPDATE TRICYCLE ====================
export const updateTricycle = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).send(`No Tricycle with id: ${id}`);

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle) {
      return res.status(404).json({ success: false, message: "Tricycle not found" });
    }

    // If user is authenticated and is an operator, verify ownership
    if (req.user && req.user.role === 'operator') {
      if (tricycle.operator.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own tricycles",
        });
      }
    }

    const { plateNumber, model, operator, driver, status, existingImages = [] } = req.body;

    // Upload new images to Cloudinary (if any)
    let newImageLinks = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        newImageLinks.push({ public_id: result.public_id, url: result.secure_url });
      }
    }

    // Delete images that are not in the existingImages list
    await Promise.all(
      tricycle.images.map(async (img) => {
        if (!existingImages.includes(img.url)) {
          await cloudinary.uploader.destroy(img.public_id);
        }
      })
    );

    // Merge retained + newly uploaded images
    const updatedImages = [
      ...tricycle.images.filter((img) => existingImages.includes(img.url)),
      ...newImageLinks,
    ];

    const updatedData = {
      plateNumber: plateNumber || tricycle.plateNumber,
      model: model || tricycle.model,
      // Operators cannot change the operator field - it's always their own
      operator: (req.user && req.user.role === 'operator') ? req.user.id : (operator || tricycle.operator),
      driver: driver || tricycle.driver,
      status: status || tricycle.status,
      images: updatedImages,
    };

    const updatedTricycle = await Tricycle.findByIdAndUpdate(id, updatedData, {
      new: true,
    })
      .populate("operator", "firstname lastname username email")
      .populate("driver", "firstname lastname username email phone image");

    res.status(200).json({ success: true, data: updatedTricycle });
  } catch (error) {
    console.error("Error updating tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==================== DELETE TRICYCLE ====================
export const deleteTricycle = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).send(`No Tricycle with id: ${id}`);

  try {
    const tricycle = await Tricycle.findById(id);
    if (!tricycle)
      return res.status(404).json({ success: false, message: "Tricycle not found" });

    // If user is authenticated and is an operator, verify ownership
    if (req.user && req.user.role === 'operator') {
      if (tricycle.operator.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own tricycles",
        });
      }
    }

    // Delete Cloudinary images
    if (tricycle.images && tricycle.images.length > 0) {
      await Promise.all(
        tricycle.images.map(async (img) => {
          await cloudinary.uploader.destroy(img.public_id);
        })
      );
    }

    await Tricycle.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: "Tricycle deleted successfully" });
  } catch (error) {
    console.error("Error deleting tricycle:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
