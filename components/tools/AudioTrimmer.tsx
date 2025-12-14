"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileUpload } from "@/components/FileUpload";
import { Download, Play, Pause, Square, Music, Loader2 } from "lucide-react";
import { formatDuration, revokeObjectURL } from "@/lib/file-utils";
import { toast } from "sonner";
import WaveSurfer from "wavesurfer.js";

export function AudioTrimmer() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wavesurfer, setWavesurfer] = useState<WaveSurfer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(100);
  const durationRef = useRef(0);

  // Initialize WaveSurfer
  useEffect(() => {
    if (waveformRef.current && audioUrl && audioFile) {
      let isMounted = true;
      let ws: WaveSurfer | null = null;

      const initWaveSurfer = async () => {
        try {
          ws = WaveSurfer.create({
            container: waveformRef.current!,
            waveColor: "hsl(var(--muted-foreground))",
            progressColor: "hsl(var(--primary))",
            cursorColor: "hsl(var(--primary))",
            cursorWidth: 3,
            barWidth: 2,
            barRadius: 3,
            height: 100,
            normalize: true,
            interact: true,
          });

          ws.on("ready", () => {
            if (!isMounted) return;
            const dur = ws!.getDuration();
            setDuration(dur);
            setTrimEnd(dur);
            durationRef.current = dur;
            trimEndRef.current = dur;
            setIsLoading(false);
          });

          ws.on("error", (error) => {
            if (!isMounted) return;
            console.error("WaveSurfer error:", error);
            setIsLoading(false);
            toast.error("Failed to load audio file. Please try again.");
          });

          ws.on("play", () => {
            if (!isMounted) return;
            setIsPlaying(true);
          });

          ws.on("pause", () => {
            if (!isMounted) return;
            setIsPlaying(false);
          });

          ws.on("finish", () => {
            if (!isMounted) return;
            setIsPlaying(false);
            if (durationRef.current > 0) {
              ws!.seekTo(trimStartRef.current / durationRef.current);
            }
          });

          ws.on("timeupdate", (time) => {
            if (!isMounted) return;
            setCurrentTime(time);
            // Stop at trim end
            if (time >= trimEndRef.current) {
              ws!.pause();
              if (durationRef.current > 0) {
                ws!.seekTo(trimStartRef.current / durationRef.current);
              }
            }
          });

          if (isMounted) {
            setWavesurfer(ws);
            // Load audio using blob directly
            await ws.load(audioUrl);
          }
        } catch (error) {
          if (isMounted) {
            console.error("Failed to initialize WaveSurfer:", error);
            setIsLoading(false);
            toast.error(
              "Failed to load audio file. Please try a different file."
            );
          }
        }
      };

      initWaveSurfer();

      return () => {
        isMounted = false;
        if (ws) {
          ws.destroy();
        }
      };
    }
  }, [audioUrl, audioFile]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wavesurfer) {
        wavesurfer.destroy();
      }
      if (audioUrl) {
        revokeObjectURL(audioUrl);
      }
    };
  }, [wavesurfer, audioUrl]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        setIsLoading(true);
        const file = files[0];
        setAudioFile(file);

        // Cleanup previous URL
        if (audioUrl) {
          revokeObjectURL(audioUrl);
        }

        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        toast.success("Audio file loaded");
      }
    },
    [audioUrl]
  );

  const handlePlay = useCallback(() => {
    if (wavesurfer) {
      if (isPlaying) {
        wavesurfer.pause();
      } else {
        // Seek to trim start if before it
        const current = wavesurfer.getCurrentTime();
        if (current < trimStart) {
          wavesurfer.seekTo(trimStart / duration);
        }
        wavesurfer.play();
      }
    }
  }, [wavesurfer, isPlaying, trimStart, duration]);

  const handleStop = useCallback(() => {
    if (wavesurfer) {
      wavesurfer.pause();
      wavesurfer.seekTo(trimStart / duration);
    }
  }, [wavesurfer, trimStart, duration]);

  const handleTrimStartChange = useCallback(
    (value: number[]) => {
      const newStart = value[0];
      if (newStart < trimEnd) {
        setTrimStart(newStart);
        trimStartRef.current = newStart;
        if (wavesurfer) {
          wavesurfer.seekTo(newStart / duration);
        }
      }
    },
    [trimEnd, wavesurfer, duration]
  );

  const handleTrimEndChange = useCallback(
    (value: number[]) => {
      const newEnd = value[0];
      if (newEnd > trimStart) {
        setTrimEnd(newEnd);
        trimEndRef.current = newEnd;
        if (
          wavesurfer &&
          wavesurfer.isPlaying() &&
          wavesurfer.getCurrentTime() >= newEnd
        ) {
          wavesurfer.pause();
          wavesurfer.seekTo(trimStart / duration);
        }
      }
    },
    [trimStart, wavesurfer, duration]
  );

  // Drag handlers for trim handles
  const handleTrimDrag = useCallback(
    (e: React.MouseEvent, isStart: boolean) => {
      if (!waveformContainerRef.current || !duration) return;

      const rect = waveformContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * duration;

      if (isStart) {
        if (time < trimEnd - 0.1) {
          setTrimStart(time);
          trimStartRef.current = time;
          if (wavesurfer) {
            wavesurfer.seekTo(percentage);
          }
        }
      } else {
        if (time > trimStart + 0.1) {
          setTrimEnd(time);
          trimEndRef.current = time;
        }
      }
    },
    [duration, trimEnd, trimStart, wavesurfer]
  );

  const handleMouseDown = useCallback((isStart: boolean) => {
    if (isStart) {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingStart) {
        handleTrimDrag(e, true);
      } else if (isDraggingEnd) {
        handleTrimDrag(e, false);
      }
    },
    [isDraggingStart, isDraggingEnd, handleTrimDrag]
  );

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    if (isDraggingStart || isDraggingEnd) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [isDraggingStart, isDraggingEnd]);

  const handleDownload = useCallback(async () => {
    if (!audioFile || !audioUrl) {
      toast.error("Please upload an audio file first");
      return;
    }

    setIsProcessing(true);
    try {
      // Create audio context for trimming
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Read the file directly instead of fetching the blob URL
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(trimStart * sampleRate);
      const endSample = Math.floor(trimEnd * sampleRate);
      const length = endSample - startSample;

      // Create new audio buffer with trimmed data
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        sampleRate
      );

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          trimmedData[i] = channelData[startSample + i];
        }
      }

      // Convert to WAV
      const wav = audioBufferToWav(trimmedBuffer);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = audioFile.name.replace(/\.[^/.]+$/, "") + "_trimmed.wav";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Trimmed audio downloaded");
    } catch (error) {
      toast.error("Failed to trim audio");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, [audioFile, audioUrl, trimStart, trimEnd]);

  // Convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(channel)[i])
        );
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return arrayBuffer;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio Trimmer</CardTitle>
        <CardDescription>
          Upload audio, visualize the waveform, and trim to your desired section
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FileUpload
          accept={[
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/mp4",
            ".mp3",
            ".wav",
            ".ogg",
            ".m4a",
          ]}
          onFilesSelected={handleFilesSelected}
          onError={(error) => toast.error(error)}
          disabled={isLoading || isProcessing}
        >
          {isLoading ? (
            <div className="space-y-4">
              <Loader2 className="size-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading audio...</p>
            </div>
          ) : (
            <>
              <Music className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Supports MP3, WAV, OGG, M4A
              </p>
            </>
          )}
        </FileUpload>

        {audioUrl && (
          <>
            {/* Waveform Display */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Waveform</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {formatDuration(currentTime)} / {formatDuration(duration)}
                  </span>
                </div>
              </div>
              <div
                ref={waveformContainerRef}
                className="border rounded-lg p-6 bg-muted/30 min-h-[200px] relative"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{
                  cursor:
                    isDraggingStart || isDraggingEnd ? "ew-resize" : "default",
                }}
              >
                <div ref={waveformRef} className="w-full" />

                {/* Current time playhead indicator */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-red-500 z-20 pointer-events-none"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500"></div>
                  </div>
                )}

                {/* Trim handles */}
                {duration > 0 && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-primary z-10 cursor-ew-resize hover:w-2"
                      style={{
                        left: `${(trimStart / duration) * 100}%`,
                        transition: isDraggingStart
                          ? "none"
                          : "width 0.15s ease",
                      }}
                      onMouseDown={() => handleMouseDown(true)}
                    >
                      <div
                        className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-md hover:scale-110"
                        style={{
                          transition: isDraggingStart
                            ? "none"
                            : "transform 0.15s ease",
                        }}
                      ></div>
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-primary z-10 cursor-ew-resize hover:w-2"
                      style={{
                        left: `${(trimEnd / duration) * 100}%`,
                        transition: isDraggingEnd ? "none" : "width 0.15s ease",
                      }}
                      onMouseDown={() => handleMouseDown(false)}
                    >
                      <div
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-md hover:scale-110"
                        style={{
                          transition: isDraggingEnd
                            ? "none"
                            : "transform 0.15s ease",
                        }}
                      ></div>
                    </div>
                    <div
                      className="absolute top-0 bottom-0 bg-primary/10 border-l-2 border-r-2 border-primary z-5 pointer-events-none"
                      style={{
                        left: `${(trimStart / duration) * 100}%`,
                        width: `${((trimEnd - trimStart) / duration) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>

              {/* Trim controls */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trim-start">Start Time</Label>
                    <Input
                      id="trim-start"
                      type="text"
                      placeholder="00:00"
                      value={formatDuration(trimStart)}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trim-end">End Time</Label>
                    <Input
                      id="trim-end"
                      type="text"
                      placeholder="00:00"
                      value={formatDuration(trimEnd)}
                      readOnly
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Start: {formatDuration(trimStart)}</Label>
                  <Slider
                    value={[trimStart]}
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleTrimStartChange}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End: {formatDuration(trimEnd)}</Label>
                  <Slider
                    value={[trimEnd]}
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    onValueChange={handleTrimEndChange}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="space-y-4 border-t pt-6">
              <Label>Preview Trimmed Section</Label>
              <div className="border rounded-lg p-4 bg-muted/30 min-h-[100px] flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePlay}
                    disabled={!wavesurfer}
                  >
                    {isPlaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleStop}
                    disabled={!wavesurfer}
                  >
                    <Square className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(trimEnd - trimStart)} trimmed section
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="border-t pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleDownload}
                disabled={isProcessing || !audioFile}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="size-4 mr-2" />
                    Download Trimmed Audio
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
