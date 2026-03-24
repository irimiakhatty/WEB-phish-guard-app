import { v2 as cloudinary } from "cloudinary";
import { env } from "@phish-guard-app/env/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

export const CLOUDINARY_FOLDERS = {
  avatars: "phishguard/avatars",
  scans: "phishguard/scans",
} as const;
