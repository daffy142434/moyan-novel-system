import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { GenerationService } from './generation.service';

@Controller()
@UseGuards(AuthGuard)
export class GenerationController {
  constructor(@Inject(GenerationService) private readonly generation: GenerationService) {}

  @Post('projects/:projectId/generation-runs')
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() body: { stepKey?: string; instruction?: string; idempotencyKey?: string },
  ) {
    return this.generation.createRun(request.user.id, projectId, body);
  }

  @Get('generation-runs/:runId')
  get(@Req() request: AuthenticatedRequest, @Param('runId') runId: string) {
    return this.generation.getRun(request.user.id, runId);
  }

  @Post('generation-runs/:runId/cancel')
  cancel(@Req() request: AuthenticatedRequest, @Param('runId') runId: string) {
    return this.generation.cancel(request.user.id, runId);
  }
}
