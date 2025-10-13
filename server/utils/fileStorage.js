require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { getSupabaseAdmin } = require('../config/supabase');

async function uploadFile(file, bucket = 'documents') {
  const results = {
    filename: file.filename,
    size: file.size,
    localPath: file.path,
    supabaseUrl: null,
    localSuccess: true,
    supabaseSuccess: false,
    errors: []
  };

  try {
    try {
      await fs.access(file.path);
      results.localSuccess = true;
    } catch (err) {
      results.localSuccess = false;
      results.errors.push(`Local storage failed: ${err.message}`);
    }

    try {
      const supabase = getSupabaseAdmin();
      const fileBuffer = await fs.readFile(file.path);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(file.filename, fileBuffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(file.filename);

      results.supabaseUrl = urlData.publicUrl;
      results.supabaseSuccess = true;
    } catch (err) {
      results.supabaseSuccess = false;
      results.errors.push(`Supabase storage failed: ${err.message}`);
      console.error('Supabase upload error:', err);
    }

    return results;
  } catch (err) {
    results.errors.push(`Upload failed: ${err.message}`);
    console.error('File upload error:', err);
    return results;
  }
}

async function deleteFile(filename, bucket = 'documents') {
  const results = {
    localSuccess: false,
    supabaseSuccess: false,
    errors: []
  };

  try {
    const localPath = path.join(__dirname, '../data/documents', filename);
    await fs.unlink(localPath);
    results.localSuccess = true;
  } catch (err) {
    results.errors.push(`Local delete failed: ${err.message}`);
    console.error('Local file delete error:', err);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filename]);

    if (error) {
      throw error;
    }

    results.supabaseSuccess = true;
  } catch (err) {
    results.errors.push(`Supabase delete failed: ${err.message}`);
    console.error('Supabase file delete error:', err);
  }

  return results;
}

async function getFileUrl(filename, bucket = 'documents') {
  try {
    const localPath = path.join(__dirname, '../data/documents', filename);
    await fs.access(localPath);
    return {
      url: `/api/files/${filename}`,
      source: 'local'
    };
  } catch (err) {
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);

    return {
      url: data.publicUrl,
      source: 'supabase'
    };
  } catch (err) {
    throw new Error(`File not found in local or cloud storage: ${filename}`);
  }
}

async function syncLocalToSupabase(bucket = 'documents') {
  const results = {
    synced: 0,
    failed: 0,
    errors: []
  };

  try {
    const docsDir = path.join(__dirname, '../data/documents');
    const files = await fs.readdir(docsDir);
    const supabase = getSupabaseAdmin();

    for (const filename of files) {
      if (!filename.endsWith('.pdf')) continue;

      try {
        const filePath = path.join(docsDir, filename);
        const fileBuffer = await fs.readFile(filePath);

        const { error } = await supabase.storage
          .from(bucket)
          .upload(filename, fileBuffer, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (error) {
          throw error;
        }

        results.synced++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${filename}: ${err.message}`);
      }
    }

    return results;
  } catch (err) {
    results.errors.push(`Sync failed: ${err.message}`);
    return results;
  }
}

async function downloadFromSupabase(filename, bucket = 'documents') {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filename);

    if (error) {
      throw error;
    }

    const localPath = path.join(__dirname, '../data/documents', filename);
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(localPath, buffer);

    return true;
  } catch (err) {
    console.error('Download from Supabase failed:', err);
    return false;
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  getFileUrl,
  syncLocalToSupabase,
  downloadFromSupabase
};
