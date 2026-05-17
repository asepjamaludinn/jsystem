import { supabase } from "../config/supabase.js";
import path from "path";

export const uploadAvatarToSupabase = async (file, userId, oldAvatarUrl) => {
  const fileExt = path.extname(file.originalname);
  const fileName = `avatar-${userId}-${Date.now()}${fileExt}`;

  if (
    oldAvatarUrl &&
    oldAvatarUrl.includes("supabase.co/storage/v1/object/public/avatars/")
  ) {
    const oldFileName = oldAvatarUrl.split("/").pop();
    if (oldFileName) {
      await supabase.storage.from("avatars").remove([oldFileName]);
    }
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};
