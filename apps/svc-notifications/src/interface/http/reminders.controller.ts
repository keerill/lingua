import { Controller, Post } from '@nestjs/common';
import { RunRemindersUseCase } from '../../application/run-reminders.usecase';

@Controller('internal')
export class RemindersController {
  constructor(private readonly runReminders: RunRemindersUseCase) {}

  @Post('run-reminders')
  async run(): Promise<{ sent: number }> {
    const sent = await this.runReminders.execute();
    return { sent };
  }
}
