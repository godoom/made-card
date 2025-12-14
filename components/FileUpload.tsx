"use client";

import React, { useCallback, useState, useRef, DragEvent } from "react";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFile, type FileValidationResult } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface FileUploadProps {
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FileUpload({
  accept = [],
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  onFilesSelected,
  onError,
  disabled = false,
  className,
  children,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];
      const errors: string[] = [];

      setIsProcessing(true);
      setProgress(0);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProgress(((i + 1) / fileArray.length) * 100);

        const validation: FileValidationResult = validateFile(
          file,
          accept,
          maxSize
        );

        if (validation.valid) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${validation.error}`);
        }

        // Small delay to show progress
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      setIsProcessing(false);
      setProgress(0);

      if (errors.length > 0 && onError) {
        onError(errors.join("\n"));
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [accept, maxSize, onFilesSelected, onError]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.currentTarget === e.target ||
      !e.currentTarget.contains(e.relatedTarget as Node)
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isProcessing) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await validateAndProcessFiles(files);
      }
    },
    [disabled, isProcessing, validateAndProcessFiles]
  );

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || isProcessing) return;

      const files = e.target.files;
      if (files && files.length > 0) {
        await validateAndProcessFiles(files);
      }

      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [disabled, isProcessing, validateAndProcessFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isProcessing) {
      fileInputRef.current?.click();
    }
  }, [disabled, isProcessing]);

  const acceptString =
    accept.length > 0
      ? accept
          .map((type) =>
            type.startsWith(".") ? type : type.includes("/") ? type : `.${type}`
          )
          .join(",")
      : undefined;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
          isDragging && !disabled
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed",
          isProcessing && "cursor-wait"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          onChange={handleFileInputChange}
          disabled={disabled || isProcessing}
          className="hidden"
        />
        {isProcessing ? (
          <div className="space-y-4">
            <Loader2 className="size-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Processing files...</p>
            <Progress value={progress} className="w-full max-w-xs mx-auto" />
          </div>
        ) : (
          children || (
            <>
              <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                {accept.length > 0
                  ? `Supports ${accept.join(", ")}`
                  : "All file types"}
                {maxSize && ` (Max ${maxSize / (1024 * 1024)}MB)`}
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}
