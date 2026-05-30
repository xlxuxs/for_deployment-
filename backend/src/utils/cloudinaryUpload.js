const { v2: cloudinary } = require("cloudinary");

let configured = false;

function configureCloudinary() {
  if (configured) return;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  configured = true;
}

function uploadBufferToCloudinary(buffer, options = {}) {
  configureCloudinary();

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary credentials are not configured.");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: "planner-requests",
        use_filename: true,
        unique_filename: true,
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

module.exports = {
  uploadBufferToCloudinary,
};
