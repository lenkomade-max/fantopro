import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs-extra';

export interface TranscodeOptions {
  width?: number;
  height?: number;
  format?: 'mp4' | 'webm';
}

export class Transcoder {
  private readonly outputDir = path.join(process.cwd(), '.overlay-cache', 'transcoded');

  constructor() {
    fs.ensureDirSync(this.outputDir);
  }

  async isCompatible(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          resolve(false);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          resolve(false);
          return;
        }

        const isH264 = videoStream.codec_name === 'h264';
        const isYuv420p = videoStream.pix_fmt === 'yuv420p';
        const isMp4 = path.extname(videoPath).toLowerCase() === '.mp4';

        resolve(isH264 && isYuv420p && isMp4);
      });
    });
  }

  async transcode(
    inputPath: string,
    outputHash: string,
    options: TranscodeOptions = {}
  ): Promise<string> {
    const outputPath = path.join(this.outputDir, `${outputHash}.mp4`);

    if (await fs.pathExists(outputPath)) {
      return outputPath;
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-preset fast',
          '-crf 23'
        ])
        .format('mp4');

      if (options.width && options.height) {
        command = command.size(`${options.width}x${options.height}`);
      }

      command
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  async extractThumbnail(videoPath: string, outputHash: string): Promise<string> {
    const thumbnailPath = path.join(this.outputDir, `${outputHash}_thumb.jpg`);

    if (await fs.pathExists(thumbnailPath)) {
      return thumbnailPath;
    }

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: `${outputHash}_thumb.jpg`,
          folder: this.outputDir,
          size: '320x240'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', (err) => reject(err));
    });
  }
}