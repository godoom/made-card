"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUpload } from "@/components/FileUpload";
import { Download, Zap, Lock, Unlock, X, Loader2 } from "lucide-react";
import { formatFileSize, revokeObjectURL } from "@/lib/file-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProcessedImage {
  id: string;
  file: File;
  preview: string;
  resizedPreview: string | null;
  originalSize: number;
  processedBlob: Blob | null;
  processedSize: number;
  width: number;
  height: number;
}

export function ImageCompressor() {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [quality, setQuality] = useState([100]);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSizes, setPreviewSizes] = useState<Map<string, number>>(
    new Map()
  );
  const [resizedPreviews, setResizedPreviews] = useState<Map<string, string>>(
    new Map()
  );
  const [isCalculatingPreview, setIsCalculatingPreview] = useState(false);
  const [calculatingImageIds, setCalculatingImageIds] = useState<Set<string>>(
    new Set()
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imagesRef = useRef<ProcessedImage[]>(images);
  const resizedPreviewsRef = useRef<Map<string, string>>(resizedPreviews);

  // Keep refs in sync
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    resizedPreviewsRef.current = resizedPreviews;
  }, [resizedPreviews]);

  // Cleanup object URLs on unmount only
  useEffect(() => {
    return () => {
      // Use refs to get latest values on unmount
      imagesRef.current.forEach((img) => {
        revokeObjectURL(img.preview);
        if (img.resizedPreview) {
          revokeObjectURL(img.resizedPreview);
        }
      });
      resizedPreviewsRef.current.forEach((url) => revokeObjectURL(url));
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  // Calculate preview file size and generate resized previews when quality/dimensions change for all images
  useEffect(() => {
    const currentImages = imagesRef.current;

    if (currentImages.length === 0 || isProcessing) {
      setPreviewSizes(new Map());
      setResizedPreviews(new Map());
      return;
    }

    // Clear previous timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Debounce the calculation
    setIsCalculatingPreview(true);
    setCalculatingImageIds(new Set(currentImages.map((img) => img.id)));

    previewTimeoutRef.current = setTimeout(async () => {
      const newPreviewSizes = new Map<string, number>();
      const newResizedPreviews = new Map<string, string>();
      const oldPreviews = resizedPreviewsRef.current;

      // Calculate preview sizes for all images in parallel
      const calculations = currentImages.map(async (image) => {
        try {
          // If 100% quality and no custom size (or no dimensions set), use original file size
          if (quality[0] === 100 && (!useCustomSize || (!width && !height))) {
            newPreviewSizes.set(image.id, image.file.size);
            // Don't create a resized preview, will fall back to original
            return;
          }

          // Always use the original file, not the preview URL
          const img = new Image();
          const imageUrl = URL.createObjectURL(image.file);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              URL.revokeObjectURL(imageUrl);
              resolve();
            };
            img.onerror = () => {
              URL.revokeObjectURL(imageUrl);
              reject(new Error("Failed to load image"));
            };
            img.src = imageUrl;
          });

          const canvas = document.createElement("canvas");
          let targetWidth = img.width;
          let targetHeight = img.height;

          // Calculate dimensions only if custom size is enabled
          if (useCustomSize && (width || height)) {
            const aspectRatio = img.width / img.height;
            const targetW = width ? parseInt(width) : null;
            const targetH = height ? parseInt(height) : null;

            if (aspectRatioLocked) {
              if (targetW) {
                targetWidth = targetW;
                targetHeight = targetWidth / aspectRatio;
              } else if (targetH) {
                targetHeight = targetH;
                targetWidth = targetHeight * aspectRatio;
              }
            } else {
              targetWidth = targetW || targetWidth;
              targetHeight = targetH || targetHeight;
            }
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Determine output format - preserve original format at 100% quality
          const isPNG = image.file.type === "image/png";
          const isWebP = image.file.type === "image/webp";

          // At 100% quality, try to preserve original format
          // PNG doesn't support quality, so keep as PNG at 100%
          // Otherwise use original format or JPEG
          const outputFormat =
            quality[0] === 100
              ? isPNG
                ? "image/png"
                : isWebP
                ? "image/webp"
                : "image/jpeg"
              : isPNG
              ? "image/jpeg" // Convert PNG to JPEG for compression
              : isWebP
              ? "image/webp" // Keep WebP as WebP
              : "image/jpeg"; // Default to JPEG
          const outputQuality =
            isPNG && quality[0] === 100 ? undefined : quality[0] / 100;

          await new Promise<void>((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  newPreviewSizes.set(image.id, blob.size);

                  // Create new resized preview URL
                  const resizedPreviewUrl = URL.createObjectURL(blob);
                  newResizedPreviews.set(image.id, resizedPreviewUrl);
                }
                resolve();
              },
              outputFormat,
              outputQuality
            );
          });
        } catch (error) {
          console.error(
            `Failed to calculate preview size for ${image.file.name}:`,
            error
          );
        }
      });

      // Wait for all calculations to complete
      await Promise.all(calculations);

      // Update state first
      setPreviewSizes(newPreviewSizes);
      setResizedPreviews(newResizedPreviews);
      setIsCalculatingPreview(false);
      setCalculatingImageIds(new Set());

      // Clean up old resized preview URLs after a short delay
      // This ensures React has updated the DOM with new preview URLs first
      setTimeout(() => {
        oldPreviews.forEach((url, id) => {
          // Only revoke if this image ID isn't in the new previews
          if (!newResizedPreviews.has(id)) {
            URL.revokeObjectURL(url);
          }
        });
      }, 100);
    }, 300); // 300ms debounce

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [
    // Track changes to these values to trigger preview updates
    quality,
    width,
    height,
    aspectRatioLocked,
    useCustomSize,
    isProcessing,
    images.length,
    images[0]?.id,
  ]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newImages: ProcessedImage[] = [];

    for (const file of files) {
      try {
        const preview = URL.createObjectURL(file);
        const img = new Image();

        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            newImages.push({
              id: `${Date.now()}-${Math.random()}`,
              file,
              preview,
              resizedPreview: null,
              originalSize: file.size,
              processedBlob: null,
              processedSize: file.size,
              width: img.width,
              height: img.height,
            });
            resolve();
          };
          img.onerror = reject;
          img.src = preview;
        });
      } catch (error) {
        toast.error(`Failed to load ${file.name}`);
        console.error(error);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    toast.success(`Loaded ${newImages.length} image(s)`);
  }, []);

  const processImage = useCallback(
    async (image: ProcessedImage): Promise<Blob> => {
      // If 100% quality and no custom size (or custom size enabled but no dimensions set), return original file as blob
      if (quality[0] === 100 && (!useCustomSize || (!width && !height))) {
        return image.file;
      }

      return new Promise((resolve, reject) => {
        const img = new Image();
        // Always use the original file, not the preview URL
        const imageUrl = URL.createObjectURL(image.file);

        img.onload = () => {
          // Clean up the temporary URL
          URL.revokeObjectURL(imageUrl);

          const canvas = document.createElement("canvas");
          let targetWidth = img.width;
          let targetHeight = img.height;

          // Calculate dimensions only if custom size is enabled
          if (useCustomSize && (width || height)) {
            const aspectRatio = img.width / img.height;
            const targetW = width ? parseInt(width) : null;
            const targetH = height ? parseInt(height) : null;

            if (aspectRatioLocked) {
              if (targetW) {
                targetWidth = targetW;
                targetHeight = targetWidth / aspectRatio;
              } else if (targetH) {
                targetHeight = targetH;
                targetWidth = targetHeight * aspectRatio;
              }
            } else {
              targetWidth = targetW || targetWidth;
              targetHeight = targetH || targetHeight;
            }
          }

          // Determine output format - preserve original format at 100% quality
          const isPNG = image.file.type === "image/png";
          const isWebP = image.file.type === "image/webp";
          const isJPEG =
            image.file.type === "image/jpeg" || image.file.type === "image/jpg";

          // At 100% quality, try to preserve original format
          // PNG doesn't support quality, so keep as PNG at 100%
          // Otherwise use original format or JPEG
          const outputFormat =
            quality[0] === 100
              ? isPNG
                ? "image/png"
                : isWebP
                ? "image/webp"
                : "image/jpeg"
              : isPNG
              ? "image/jpeg" // Convert PNG to JPEG for compression
              : isWebP
              ? "image/webp" // Keep WebP as WebP
              : "image/jpeg"; // Default to JPEG
          const outputQuality =
            isPNG && quality[0] === 100 ? undefined : quality[0] / 100;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Use high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to create blob"));
              }
            },
            outputFormat,
            outputQuality
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error("Failed to load image"));
        };
        img.src = imageUrl;
      });
    },
    [width, height, aspectRatioLocked, useCustomSize, quality]
  );

  const handleProcess = useCallback(async () => {
    if (images.length === 0) {
      toast.error("Please upload images first");
      return;
    }

    setIsProcessing(true);
    try {
      const processedImages = await Promise.all(
        images.map(async (image) => {
          const blob = await processImage(image);
          return {
            ...image,
            processedBlob: blob,
            processedSize: blob.size,
          };
        })
      );

      setImages(processedImages);
      toast.success("Images processed successfully");
    } catch (error) {
      toast.error("Failed to process images");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [images, processImage]);

  const handleDownload = useCallback(async (image: ProcessedImage) => {
    if (!image.processedBlob) {
      toast.error("Please process the image first");
      return;
    }

    const url = URL.createObjectURL(image.processedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      image.file.name.replace(/\.[^/.]+$/, "") +
      "_processed." +
      (image.file.type.includes("png") ? "png" : "jpg");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    revokeObjectURL(url);
    toast.success("Download started");
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const processedImages = images.filter((img) => img.processedBlob);
    if (processedImages.length === 0) {
      toast.error("Please process images first");
      return;
    }

    for (const image of processedImages) {
      await handleDownload(image);
      // Small delay between downloads
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [images, handleDownload]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        revokeObjectURL(image.preview);
        if (image.resizedPreview) {
          revokeObjectURL(image.resizedPreview);
        }
      }
      return prev.filter((img) => img.id !== id);
    });

    // Also clean up resized preview from map
    setResizedPreviews((prev) => {
      const newMap = new Map(prev);
      const url = newMap.get(id);
      if (url) {
        revokeObjectURL(url);
        newMap.delete(id);
      }
      return newMap;
    });

    // Clean up preview size
    setPreviewSizes((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const clearAll = useCallback(() => {
    // Cleanup all object URLs
    images.forEach((img) => {
      revokeObjectURL(img.preview);
      if (img.resizedPreview) {
        revokeObjectURL(img.resizedPreview);
      }
    });

    // Cleanup resized previews from map
    resizedPreviews.forEach((url) => revokeObjectURL(url));

    // Reset all state
    setImages([]);
    setPreviewSizes(new Map());
    setResizedPreviews(new Map());
    setQuality([100]);
    setUseCustomSize(false);
    setWidth("");
    setHeight("");
    setAspectRatioLocked(true);

    toast.success("Cleared all images");
  }, [images, resizedPreviews]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Compressor & Resizer</CardTitle>
        <CardDescription>
          Compress and resize multiple images and adjust quality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileUpload
          accept={["image/jpeg", "image/jpg", "image/png", "image/webp"]}
          multiple
          onFilesSelected={handleFilesSelected}
          onError={(error) => toast.error(error)}
        />

        {images.length > 0 && (
          <>
            {/* Image Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>
                  Preview ({images.length}{" "}
                  {images.length === 1 ? "image" : "images"})
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4 mr-2" />
                  Clear All
                </Button>
              </div>
              <div className="border rounded-lg p-4 bg-muted/30 min-h-[300px]">
                {images.length > 0 ? (
                  <div
                    className={cn(
                      "grid gap-4",
                      images.length === 1
                        ? "grid-cols-1"
                        : images.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                    )}
                  >
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="group relative space-y-2 transition-all rounded-lg p-2 hover:bg-muted/50"
                      >
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                          <img
                            src={resizedPreviews.get(image.id) || image.preview}
                            alt={image.file.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium truncate">
                            {image.file.name}
                          </p>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              Original: {formatFileSize(image.originalSize)}
                            </div>
                            {calculatingImageIds.has(image.id) &&
                            isCalculatingPreview ? (
                              <div className="text-primary">Calculating...</div>
                            ) : image.processedBlob ? (
                              <div>
                                Processed: {formatFileSize(image.processedSize)}
                              </div>
                            ) : previewSizes.has(image.id) ? (
                              <div className="text-primary">
                                Resulting size:{" "}
                                {formatFileSize(previewSizes.get(image.id)!)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(image.id);
                          }}
                          className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[300px]">
                    <p className="text-muted-foreground text-sm">
                      No images to preview
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Compression Settings */}
            <div className="space-y-4 border-t pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quality">Quality: {quality[0]}%</Label>
                  <span className="text-sm text-muted-foreground">
                    Same compression and resize settings will be applied to all{" "}
                    {images.length} image{images.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {images.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Same compression and resize settings will be applied to all{" "}
                    {images.length} images
                  </p>
                )}
                <Slider
                  id="quality"
                  min={1}
                  max={100}
                  value={quality}
                  onValueChange={setQuality}
                  className="w-full"
                />
              </div>
            </div>

            {/* Resize Settings */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <Label>Resize Dimensions</Label>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="custom-size"
                    className="text-sm cursor-pointer"
                  >
                    Custom Size
                  </Label>
                  <Switch
                    id="custom-size"
                    checked={useCustomSize}
                    onCheckedChange={(checked) => {
                      setUseCustomSize(checked);
                      if (!checked) {
                        // Reset to original sizes
                        setWidth("");
                        setHeight("");
                      }
                    }}
                  />
                </div>
              </div>

              {useCustomSize ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {aspectRatioLocked ? (
                        <Lock className="size-4 text-muted-foreground" />
                      ) : (
                        <Unlock className="size-4 text-muted-foreground" />
                      )}
                      <Label
                        htmlFor="aspect-lock"
                        className="text-sm cursor-pointer"
                      >
                        Lock Aspect Ratio
                      </Label>
                    </div>
                    <Switch
                      id="aspect-lock"
                      checked={aspectRatioLocked}
                      onCheckedChange={setAspectRatioLocked}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="width">Width (px)</Label>
                      <Input
                        id="width"
                        type="number"
                        min="1"
                        placeholder={images[0]?.width.toString() || "Width"}
                        value={width}
                        onChange={(e) => {
                          const value = e.target.value;
                          setWidth(value);
                          // Auto-calculate height if aspect ratio is locked
                          if (
                            aspectRatioLocked &&
                            images[0] &&
                            value &&
                            !isNaN(parseInt(value))
                          ) {
                            const widthValue = parseInt(value);
                            const aspectRatio =
                              images[0].width / images[0].height;
                            const newHeight = Math.round(
                              widthValue / aspectRatio
                            );
                            setHeight(newHeight.toString());
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (px)</Label>
                      <Input
                        id="height"
                        type="number"
                        min="1"
                        placeholder={images[0]?.height.toString() || "Height"}
                        value={height}
                        onChange={(e) => {
                          const value = e.target.value;
                          setHeight(value);
                          // Auto-calculate width if aspect ratio is locked
                          if (
                            aspectRatioLocked &&
                            images[0] &&
                            value &&
                            !isNaN(parseInt(value))
                          ) {
                            const heightValue = parseInt(value);
                            const aspectRatio =
                              images[0].width / images[0].height;
                            const newWidth = Math.round(
                              heightValue * aspectRatio
                            );
                            setWidth(newWidth.toString());
                          }
                        }}
                        disabled={aspectRatioLocked && !width}
                      />
                    </div>
                  </div>

                  {images.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Original (first image): {images[0].width} ×{" "}
                      {images[0].height}px
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Images will be processed at their original dimensions
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t pt-6">
              <Button
                className="flex-1"
                size="lg"
                onClick={handleProcess}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="size-4 mr-2" />
                    Process Images
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleDownloadAll}
                disabled={
                  images.every((img) => !img.processedBlob) || isProcessing
                }
              >
                <Download className="size-4 mr-2" />
                Download All
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
