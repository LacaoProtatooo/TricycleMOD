import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { useDropzone } from "react-dropzone";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import {
  fetchAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../redux/actions/announcementAction";
import {
  clearCreateStatus,
  clearUpdateStatus,
  clearDeleteStatus,
} from "../redux/reducers/announcementReducer";
import { CalenderIcon, TrashBinIcon } from "../icons";

const Announcements = () => {
  const dispatch = useDispatch();
  const {
    announcements,
    loading,
    createLoading,
    createSuccess,
    updateLoading,
    updateSuccess,
    deleteLoading,
    deleteSuccess,
    error,
  } = useSelector((state) => state.announcement);

  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    scheduledDate: "",
    expiryDate: "",
    type: "info",
    targetAudience: "all",
    isActive: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

  const dateRangeRef = useRef(null);
  const flatpickrInstance = useRef(null);

  const { isOpen, openModal, closeModal } = useModal();
  const {
    isOpen: isDeleteOpen,
    openModal: openDeleteModal,
    closeModal: closeDeleteModal,
  } = useModal();

  const announcementTypes = {
    info: { label: "Info", color: "primary", bgClass: "bg-blue-500" },
    warning: { label: "Warning", color: "warning", bgClass: "bg-yellow-500" },
    urgent: { label: "Urgent", color: "danger", bgClass: "bg-red-500" },
    maintenance: { label: "Maintenance", color: "success", bgClass: "bg-green-500" },
  };

  const targetAudienceOptions = [
    { value: "all", label: "All Users", icon: "👥" },
    { value: "driver", label: "Drivers Only", icon: "🚗" },
    { value: "operator", label: "Operators Only", icon: "👔" },
    { value: "guest", label: "Guests Only", icon: "👤" },
  ];

  // Helper to format date as YYYY-MM-DD without timezone conversion
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize date range picker
  useEffect(() => {
    if (isOpen && dateRangeRef.current) {
      flatpickrInstance.current = flatpickr(dateRangeRef.current, {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: formData.scheduledDate && formData.expiryDate 
          ? [formData.scheduledDate, formData.expiryDate]
          : formData.scheduledDate 
          ? [formData.scheduledDate] 
          : [],
        onChange: (selectedDates) => {
          if (selectedDates.length >= 1) {
            // Use local date formatting to avoid timezone conversion issues
            const startDate = formatLocalDate(selectedDates[0]);
            const endDate = selectedDates[1] 
              ? formatLocalDate(selectedDates[1]) 
              : startDate;
            setFormData((prev) => ({
              ...prev,
              scheduledDate: startDate,
              expiryDate: endDate,
            }));
          }
        },
        // Close only after selecting both dates in range mode
        closeOnSelect: false,
        onClose: () => {
          // Ensure we have both dates when closing
        },
      });
    }

    return () => {
      if (flatpickrInstance.current) {
        flatpickrInstance.current.destroy();
      }
    };
  }, [isOpen]);

  // Update flatpickr when formData changes externally
  useEffect(() => {
    if (flatpickrInstance.current && formData.scheduledDate) {
      const dates = formData.expiryDate 
        ? [formData.scheduledDate, formData.expiryDate]
        : [formData.scheduledDate];
      flatpickrInstance.current.setDate(dates, false);
    }
  }, [formData.scheduledDate, formData.expiryDate]);

  // Image dropzone
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      setRemoveImage(false);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  useEffect(() => {
    dispatch(fetchAllAnnouncements());
  }, [dispatch]);

  useEffect(() => {
    if (createSuccess) {
      closeModal();
      resetForm();
      dispatch(clearCreateStatus());
    }
  }, [createSuccess, dispatch]);

  useEffect(() => {
    if (updateSuccess) {
      closeModal();
      resetForm();
      dispatch(clearUpdateStatus());
    }
  }, [updateSuccess, dispatch]);

  useEffect(() => {
    if (deleteSuccess) {
      closeDeleteModal();
      setSelectedAnnouncement(null);
      dispatch(clearDeleteStatus());
    }
  }, [deleteSuccess, dispatch]);

  // Transform announcements to calendar events
  const calendarEvents = announcements.map((announcement) => ({
    id: announcement._id,
    title: announcement.title,
    start: announcement.scheduledDate,
    end: announcement.expiryDate,
    extendedProps: {
      ...announcement,
      calendar: announcementTypes[announcement.type]?.color || "primary",
    },
  }));

  const handleDateSelect = (selectInfo) => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      scheduledDate: selectInfo.startStr,
      expiryDate: selectInfo.endStr || selectInfo.startStr,
    }));
    openModal();
  };

  const handleEventClick = (clickInfo) => {
    const announcement = clickInfo.event.extendedProps;
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      scheduledDate: announcement.scheduledDate?.split("T")[0] || "",
      expiryDate: announcement.expiryDate?.split("T")[0] || "",
      type: announcement.type,
      targetAudience: announcement.targetAudience,
      isActive: announcement.isActive,
    });
    // Set existing image preview
    if (announcement.image?.url) {
      setImagePreview(announcement.image.url);
    }
    openModal();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) {
      return;
    }

    // Convert image to base64 if new file uploaded
    let imageData = null;
    if (imageFile) {
      imageData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(imageFile);
      });
    }

    const payload = {
      ...formData,
      image: imageData,
      removeImage: removeImage && !imageFile,
    };

    if (selectedAnnouncement) {
      dispatch(
        updateAnnouncement({
          id: selectedAnnouncement._id,
          ...payload,
        })
      );
    } else {
      dispatch(createAnnouncement(payload));
    }
  };

  const handleDelete = () => {
    if (selectedAnnouncement) {
      dispatch(deleteAnnouncement(selectedAnnouncement._id));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      scheduledDate: "",
      expiryDate: "",
      type: "info",
      targetAudience: "all",
      isActive: true,
    });
    setSelectedAnnouncement(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
  };

  const handleModalClose = () => {
    closeModal();
    resetForm();
  };

  const renderEventContent = (eventInfo) => {
    const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar}`;
    return (
      <div
        className={`event-fc-color flex fc-event-main ${colorClass} p-1 rounded-sm`}
      >
        <div className="fc-daygrid-event-dot"></div>
        <div className="fc-event-time">{eventInfo.timeText}</div>
        <div className="fc-event-title">{eventInfo.event.title}</div>
      </div>
    );
  };

  const formatDateRange = () => {
    if (!formData.scheduledDate) return "Click to select date range";
    if (formData.scheduledDate === formData.expiryDate || !formData.expiryDate) {
      return formData.scheduledDate;
    }
    return `${formData.scheduledDate} to ${formData.expiryDate}`;
  };

  return (
    <>
      <PageMeta
        title="Announcements Management | TricycleMOD Admin"
        description="Manage announcements for TricycleMOD application"
      />

      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
          Announcements Management
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Create and manage announcements that will be displayed to app users
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/30 dark:border-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="custom-calendar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next addAnnouncementButton",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              events={calendarEvents}
              selectable={true}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventContent={renderEventContent}
              customButtons={{
                addAnnouncementButton: {
                  text: "Add Announcement +",
                  click: () => {
                    resetForm();
                    openModal();
                  },
                },
              }}
            />
          )}
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={isOpen}
          onClose={handleModalClose}
          className="max-w-[800px] p-6 lg:p-8"
        >
          <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar max-h-[85vh]">
            <div>
              <h5 className="mb-2 font-semibold text-gray-800 modal-title text-xl dark:text-white/90 lg:text-2xl">
                {selectedAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </h5>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedAnnouncement
                  ? "Update the announcement details below"
                  : "Create a new announcement with optional featured image"}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Main Content */}
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter announcement title"
                    className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Enter announcement message or article content..."
                    className="dark:bg-dark-900 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 resize-none"
                  />
                </div>

                {/* Date Range Picker */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Schedule Date Range
                  </label>
                  <div className="relative">
                    <input
                      ref={dateRangeRef}
                      type="text"
                      placeholder="Click to select date range"
                      value={formatDateRange()}
                      readOnly
                      className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 cursor-pointer"
                    />
                    <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                      <CalenderIcon className="size-5" />
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Start date = when it appears, End date = when it expires
                  </p>
                </div>

                {/* Type Selection - Visual Cards */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Announcement Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(announcementTypes).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, type: key }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          formData.type === key
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                            : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${value.bgClass}`}></span>
                          <span className={`text-sm font-medium ${
                            formData.type === key ? "text-brand-600 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                          }`}>
                            {value.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Image & Settings */}
              <div className="space-y-5">
                {/* Image Upload */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Featured Image (Optional)
                  </label>
                  {imagePreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <TrashBinIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                          : "border-gray-300 hover:border-brand-400 dark:border-gray-700 dark:hover:border-gray-600"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {isDragActive ? "Drop image here" : "Drag & drop or click to upload"}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Audience */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Target Audience
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {targetAudienceOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, targetAudience: option.value }))}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          formData.targetAudience === option.value
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                            : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{option.icon}</span>
                          <span className={`text-sm font-medium ${
                            formData.targetAudience === option.value 
                              ? "text-brand-600 dark:text-brand-400" 
                              : "text-gray-700 dark:text-gray-300"
                          }`}>
                            {option.label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active Status
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.isActive ? "Visible to users" : "Hidden from users"}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 sm:justify-between">
              <div>
                {selectedAnnouncement && (
                  <button
                    onClick={() => {
                      closeModal();
                      openDeleteModal();
                    }}
                    type="button"
                    className="flex items-center gap-2 justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                  >
                    <TrashBinIcon className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleModalClose}
                  type="button"
                  className="flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createLoading || updateLoading || !formData.title || !formData.message}
                  type="button"
                  className="flex justify-center rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading || updateLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : selectedAnnouncement ? (
                    "Update Announcement"
                  ) : (
                    "Publish Announcement"
                  )}
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteOpen}
          onClose={closeDeleteModal}
          className="max-w-[400px] p-6"
        >
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white">
              Delete Announcement
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this announcement? This action
              cannot be undone.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={closeDeleteModal}
                type="button"
                className="flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                type="button"
                className="flex justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      </div>

      {/* Announcements List */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          All Announcements
        </h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No announcements yet. Create your first announcement!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map((announcement) => (
              <div
                key={announcement._id}
                onClick={() => {
                  setSelectedAnnouncement(announcement);
                  setFormData({
                    title: announcement.title,
                    message: announcement.message,
                    scheduledDate: announcement.scheduledDate?.split("T")[0] || "",
                    expiryDate: announcement.expiryDate?.split("T")[0] || "",
                    type: announcement.type,
                    targetAudience: announcement.targetAudience,
                    isActive: announcement.isActive,
                  });
                  if (announcement.image?.url) {
                    setImagePreview(announcement.image.url);
                  }
                  openModal();
                }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-800"
              >
                {/* Card Image */}
                {announcement.image?.url ? (
                  <div className="h-32 overflow-hidden">
                    <img
                      src={announcement.image.url}
                      alt={announcement.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className={`h-2 ${announcementTypes[announcement.type]?.bgClass || "bg-blue-500"}`} />
                )}
                
                {/* Card Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-gray-800 dark:text-white line-clamp-1">
                      {announcement.title}
                    </h4>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        announcement.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                      }`}
                    >
                      {announcement.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                    {announcement.message}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
                      announcement.type === "urgent" ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" :
                      announcement.type === "warning" ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400" :
                      announcement.type === "maintenance" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" :
                      "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${announcementTypes[announcement.type]?.bgClass}`}></span>
                      {announcementTypes[announcement.type]?.label || announcement.type}
                    </span>
                    <span>
                      {announcement.scheduledDate
                        ? new Date(announcement.scheduledDate).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Announcements;
