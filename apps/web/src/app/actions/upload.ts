"use server";

import { requireAuth } from "@/lib/auth-helpers";
import cloudinary, { CLOUDINARY_FOLDERS } from "@/lib/cloudinary";
import prisma from "@phish-guard-app/db";
import { revalidatePath } from "next/cache";

export async function uploadAvatar(formData: FormData) {
  const session = await requireAuth();
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File size must be less than 5MB");
  }

  // Convert file to buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to Cloudinary
  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: CLOUDINARY_FOLDERS.avatars,
          public_id: `user_${session.user.id}`,
          overwrite: true,
          transformation: [
            { width: 200, height: 200, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });

  // Update user in database
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: result.secure_url },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true, imageUrl: result.secure_url };
}

export async function uploadScanImage(formData: FormData) {
  const session = await requireAuth();
  const file = formData.get("file") as File;

  if (!file) {
    throw new Error("No file provided");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size must be less than 10MB");
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const result = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: CLOUDINARY_FOLDERS.scans,
          public_id: `scan_${Date.now()}_${session.user.id}`,
          transformation: [
            { width: 1200, quality: "auto", fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });

  return { success: true, imageUrl: result.secure_url };
}

export async function deleteImage(publicId: string) {
  const session = await requireAuth();

  await cloudinary.uploader.destroy(publicId);

  return { success: true };
}
