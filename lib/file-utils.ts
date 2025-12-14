/**
 * File validation and utility functions
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number = MAX_FILE_SIZE
): FileValidationResult {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
    };
  }

  // Check file type
  const fileType = file.type.toLowerCase();
  const isValidType =
    allowedTypes.some((type) => fileType.includes(type.toLowerCase())) ||
    allowedTypes.some((type) => {
      const extension = type.startsWith(".") ? type : `.${type}`;
      return file.name.toLowerCase().endsWith(extension.toLowerCase());
    });

  if (!isValidType) {
    return {
      valid: false,
      error: `File type not supported. Allowed types: ${allowedTypes.join(
        ", "
      )}`,
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Clean up object URLs to prevent memory leaks
 */
export function revokeObjectURL(url: string | null | undefined): void {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Failed to revoke object URL:", error);
    }
  }
}

/**
 * Clean up multiple object URLs
 */
export function revokeObjectURLs(urls: (string | null | undefined)[]): void {
  urls.forEach(revokeObjectURL);
}
