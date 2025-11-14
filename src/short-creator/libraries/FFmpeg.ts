import ffmpeg from "fluent-ffmpeg";
import { Readable } from "node:stream";
import { logger } from "../../logger";

export class FFMpeg {
  static async init(): Promise<FFMpeg> {
    return import("@ffmpeg-installer/ffmpeg").then((ffmpegInstaller) => {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      logger.info(`FFmpeg path set to: ${ffmpegInstaller.path}`);
      return new FFMpeg();
    });
  }

  async saveNormalizedAudio(
    audio: ArrayBuffer,
    outputPath: string,
  ): Promise<string> {
    logger.debug("Normalizing audio for Whisper");
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputStream)
        .audioCodec("pcm_s16le")
        .audioChannels(1)
        .audioFrequency(16000)
        .toFormat("wav")
        .on("end", () => {
          logger.debug("Audio normalization complete");
          resolve(outputPath);
        })
        .on("error", (error: unknown) => {
          logger.error(`Error normalizing audio: ${String(error)}`);
          reject(error);
        })
        .save(outputPath);
    });
  }

  async createMp3DataUri(audio: ArrayBuffer): Promise<string> {
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    return new Promise((resolve, reject) => {
      const chunk: Buffer[] = [];

      ffmpeg()
        .input(inputStream)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3")
        .on("error", (err) => {
          reject(err);
        })
        .pipe()
        .on("data", (data: Buffer) => {
          chunk.push(data);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunk);
          resolve(`data:audio/mp3;base64,${buffer.toString("base64")}`);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  async saveToMp3(audio: ArrayBuffer, filePath: string): Promise<string> {
    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputStream)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(2)
        .toFormat("mp3")
        .save(filePath)
        .on("end", () => {
          logger.debug("Audio conversion complete");
          resolve(filePath);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }

  /**
   * Change audio speed using FFmpeg atempo filter
   * @param audio - Input audio buffer
   * @param speed - Speed multiplier (1.0-1.5, where 1.0 = normal speed)
   * @returns Modified audio buffer with changed speed
   */
  async changeAudioSpeed(
    audio: ArrayBuffer,
    speed: number = 1.0,
  ): Promise<ArrayBuffer> {
    // If speed is 1.0, return original audio (no processing needed)
    if (speed === 1.0) {
      logger.debug("Speed is 1.0, skipping audio speed change");
      return audio;
    }

    // Validate speed range (atempo filter supports 0.5-2.0, we limit to 1.0-1.5)
    if (speed < 1.0 || speed > 1.5) {
      logger.warn({ speed }, "Speed out of range (1.0-1.5), clamping");
      speed = Math.max(1.0, Math.min(1.5, speed));
    }

    logger.debug({ speed }, "Changing audio speed with atempo filter");

    const inputStream = new Readable();
    inputStream.push(Buffer.from(audio));
    inputStream.push(null);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let hasError = false;

      const command = ffmpeg()
        .input(inputStream)
        .audioFilters(`atempo=${speed}`)
        .audioCodec("pcm_s16le")
        .audioChannels(2)
        .toFormat("wav")
        .on("error", (err) => {
          if (hasError) return; // Prevent double error handling
          hasError = true;
          logger.error({ err, speed }, "Error changing audio speed");

          // If stream closed error, return original audio
          if (err.message && err.message.includes("Output stream closed")) {
            logger.warn({ speed }, "Stream closed during speed change, using original audio");
            resolve(audio);
          } else {
            reject(err);
          }
        });

      const outputStream = command.pipe();

      outputStream
        .on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          if (hasError) return; // Don't resolve if error already handled

          const buffer = Buffer.concat(chunks);
          logger.debug({ speed, originalSize: audio.byteLength, newSize: buffer.length }, "Audio speed change complete");
          resolve(buffer.buffer);
        })
        .on("error", (err) => {
          if (hasError) return; // Prevent double error handling
          hasError = true;
          logger.error({ err, speed }, "Stream error changing audio speed");

          // Fallback to original audio on stream errors
          logger.warn({ speed }, "Stream error, using original audio");
          resolve(audio);
        });
    });
  }
}
