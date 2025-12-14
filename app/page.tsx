"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, FileText, Music } from "lucide-react";
import { ImageCompressor } from "@/components/tools/ImageCompressor";
import { PDFConverter } from "@/components/tools/PDFConverter";
import { AudioTrimmer } from "@/components/tools/AudioTrimmer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold ">File Processing Toolkit</h1>
        </div>

        <Tabs defaultValue="image" className="w-full">
          <TabsList>
            <TabsTrigger value="image">
              <ImageIcon className="size-4" />
              Image Tools
            </TabsTrigger>
            <TabsTrigger value="pdf">
              <FileText className="size-4" />
              PDF Converter
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Music className="size-4" />
              Audio Trimmer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image">
            <ImageCompressor />
          </TabsContent>

          <TabsContent value="pdf">
            <PDFConverter />
          </TabsContent>

          <TabsContent value="audio">
            <AudioTrimmer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
