import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranscribeUseCase } from '../../application/transcribe.usecase';
import { SynthesizeUseCase } from '../../application/synthesize.usecase';

interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
}

@Controller()
export class SpeechController {
  constructor(
    private readonly transcribe: TranscribeUseCase,
    private readonly synthesize: SynthesizeUseCase,
  ) {}

  @Post('stt')
  @UseInterceptors(FileInterceptor('audio'))
  async stt(
    @UploadedFile() file: UploadedAudio,
    @Body('reference') reference?: string,
  ) {
    return this.transcribe.execute(file.buffer, file.mimetype, reference);
  }

  @Post('tts')
  async tts(@Body() body: { text: string; voice?: string }) {
    return this.synthesize.execute(body.text, body.voice);
  }
}
