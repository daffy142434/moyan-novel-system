import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { ShortNovelStepKey } from '@moyan/contracts';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.projects.list(request.user.id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.projects.create(request.user.id, body);
  }

  @Get(':projectId')
  get(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.projects.get(request.user.id, projectId);
  }

  @Get(':projectId/steps/:stepKey/prompt')
  getPrompt(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('stepKey') stepKey: ShortNovelStepKey,
  ) {
    return this.projects.getPrompt(request.user.id, projectId, stepKey);
  }

  @Put(':projectId/steps/:stepKey/prompt')
  updatePrompt(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('stepKey') stepKey: ShortNovelStepKey,
    @Body() body: { content?: string },
  ) {
    if (typeof body.content !== 'string') {
      throw new BadRequestException({ code: 'PROMPT_CONTENT_REQUIRED' });
    }
    return this.projects.updatePrompt(request.user.id, projectId, stepKey, body.content);
  }

  @Post(':projectId/steps/:stepKey/confirm')
  confirm(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('stepKey') stepKey: ShortNovelStepKey,
    @Body() body: { versionId?: string },
  ) {
    if (!body.versionId) throw new BadRequestException({ code: 'VERSION_ID_REQUIRED' });
    return this.projects.confirm(request.user.id, projectId, stepKey, body.versionId);
  }
}
