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

    const tricycles = await Tricycle.find(query)
      .populate("operator", "name username")
      .populate("driver", "name username");

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
      .populate("operator", "name username")
      .populate("driver", "name username");

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
    const { plateNumber, model, operator, driver, status } = req.body;

    // Validate required fields
    if (!plateNumber || !model || !operator) {
      return res.status(400).json({
        success: false,
        message: "Plate number, model, and operator are required.",
      });
    }

    // Validate operator existence
    const operatorExists = await User.findById(operator);
    if (!operatorExists) {
      return res.status(404).json({ success: false, message: "Operator not found" });
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
      operator,
      driver: driver || null,
      status: status || "unavailable",
      images: imageLinks,
    });

    await newTricycle.save();

    res.status(201).json({
      success: true,
      message: "Tricycle added successfully",
      data: newTricycle,
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
      operator: operator || tricycle.operator,
      driver: driver || tricycle.driver,
      status: status || tricycle.status,
      images: updatedImages,
    };

    const updatedTricycle = await Tricycle.findByIdAndUpdate(id, updatedData, {
      new: true,
    });

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
