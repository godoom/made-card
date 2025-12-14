"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload } from "@/components/FileUpload";
import { Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { cn } from "@/lib/utils";

interface PDFPage {
  pageNumber: number;
  thumbnail: string;
  selected: boolean;
}

// Helper to setup PDF.js worker
const setupPDFWorker = async () => {
  const pdfjsLib = await import("pdfjs-dist");

  // Only set worker if not already set
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // Use unpkg CDN which automatically resolves to the correct version
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  }

  return pdfjsLib;
};

export function PDFConverter() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cleanup thumbnails
  useEffect(() => {
    return () => {
      pages.forEach((page) => {
        if (page.thumbnail) {
          URL.revokeObjectURL(page.thumbnail);
        }
      });
    };
  }, [pages]);

  const loadPDF = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Setup PDF.js worker
      const pdfjsLib = await setupPDFWorker();

      const pdfLoadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await pdfLoadingTask.promise;
      const pageCount = pdf.numPages;

      // Generate thumbnails for all pages
      const newPages: PDFPage[] = [];

      for (let i = 1; i <= pageCount; i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 }); // Smaller scale for thumbnails
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            throw new Error("Failed to get canvas context");
          }

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Convert canvas to blob URL for thumbnail
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error("Failed to create blob"));
                }
              },
              "image/jpeg",
              0.7
            );
          });

          const thumbnailUrl = URL.createObjectURL(blob);

          newPages.push({
            pageNumber: i,
            thumbnail: thumbnailUrl,
            selected: false,
          });
        } catch (error) {
          console.error(`Failed to render thumbnail for page ${i}:`, error);
          // Add page without thumbnail
          newPages.push({
            pageNumber: i,
            thumbnail: "",
            selected: false,
          });
        }
      }

      setPages(newPages);
      setPdfFile(file);
      toast.success(`Loaded PDF with ${pageCount} page(s)`);
    } catch (error) {
      toast.error("Failed to load PDF. The file may be corrupted.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        await loadPDF(files[0]);
      }
    },
    [loadPDF]
  );

  const togglePageSelection = useCallback((pageNumber: number) => {
    setPages((prev) =>
      prev.map((page) =>
        page.pageNumber === pageNumber
          ? { ...page, selected: !page.selected }
          : page
      )
    );
  }, []);

  const selectAll = useCallback(() => {
    setPages((prev) => prev.map((page) => ({ ...page, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setPages((prev) => prev.map((page) => ({ ...page, selected: false })));
  }, []);

  const renderPDFPageToImage = useCallback(
    async (pdfBytes: ArrayBuffer, pageNumber: number): Promise<Blob> => {
      // Setup PDF.js worker
      const pdfjsLib = await setupPDFWorker();

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Failed to get canvas context");
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          "image/png",
          0.95
        );
      });
    },
    []
  );

  const handleExport = useCallback(async () => {
    if (!pdfFile || pages.filter((p) => p.selected).length === 0) {
      toast.error("Please select at least one page to export");
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const selectedPages = pages.filter((p) => p.selected);
      const zip = new JSZip();

      for (const page of selectedPages) {
        try {
          const blob = await renderPDFPageToImage(arrayBuffer, page.pageNumber);
          const fileName = `page-${page.pageNumber}.png`;
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`Failed to render page ${page.pageNumber}:`, error);
          toast.error(`Failed to render page ${page.pageNumber}`);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfFile.name.replace(/\.[^/.]+$/, "")}_pages.png.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${selectedPages.length} page(s) as PNG`);
    } catch (error) {
      toast.error("Failed to export pages");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfFile, pages, renderPDFPageToImage]);

  const selectedCount = pages.filter((p) => p.selected).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF to Image Converter</CardTitle>
        <CardDescription>
          Upload a PDF and convert selected pages to images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileUpload
          accept={["application/pdf", ".pdf"]}
          onFilesSelected={handleFilesSelected}
          onError={(error) => toast.error(error)}
          disabled={isLoading || isProcessing}
        >
          {isLoading ? (
            <div className="space-y-4">
              <Loader2 className="size-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          ) : (
            <>
              <FileText className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PDF files only</p>
            </>
          )}
        </FileUpload>

        {pages.length > 0 && (
          <>
            {/* Page Selection Controls */}
            <div className="flex items-center justify-between border-t pt-6">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedCount} page(s) selected
              </span>
            </div>

            {/* PDF Pages Thumbnails */}
            <div className="border rounded-lg p-4 min-h-[400px]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pages.map((page) => (
                  <div
                    key={page.pageNumber}
                    className={cn(
                      "relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all",
                      page.selected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => togglePageSelection(page.pageNumber)}
                  >
                    <div className="aspect-[8.5/11] bg-muted flex items-center justify-center">
                      {page.thumbnail ? (
                        <img
                          src={page.thumbnail}
                          alt={`Page ${page.pageNumber}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center">
                          <FileText className="size-8 mx-auto mb-2 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Page {page.pageNumber}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-2 left-2">
                      <Checkbox checked={page.selected} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <div className="border-t pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleExport}
                disabled={selectedCount === 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="size-4 mr-2" />
                    Export Selected Pages as ZIP ({selectedCount}{" "}
                    {selectedCount === 1 ? "image" : "images"})
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
