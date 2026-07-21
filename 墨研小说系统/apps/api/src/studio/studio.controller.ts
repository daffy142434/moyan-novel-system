import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { BuildStageKey, ProductType, StudioGenerationInputDto } from '@moyan/contracts';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { StudioService } from './studio.service';
import { StudioGenerationService } from './studio-generation.service';

@Controller('studio')
@UseGuards(AuthGuard)
export class StudioController {
  constructor(
    @Inject(StudioService) private readonly studio: StudioService,
    @Inject(StudioGenerationService) private readonly runs: StudioGenerationService,
  ) {}

  @Post('generation-runs')
  startGeneration(@Req() request: AuthenticatedRequest, @Body() body: StudioGenerationInputDto) {
    if (!body.scope) throw new BadRequestException({ code: 'GENERATION_SCOPE_REQUIRED' });
    return this.studio.startGeneration(request.user.id, body);
  }

  @Get('generation-runs/:runId')
  generationRun(@Req() request: AuthenticatedRequest, @Param('runId') runId: string) {
    return this.runs.get(request.user.id, runId);
  }

  @Post('generation-runs/:runId/cancel')
  cancelGeneration(@Req() request: AuthenticatedRequest, @Param('runId') runId: string) {
    return this.runs.cancel(request.user.id, runId);
  }

  @Get('generation-runs/:runId/events')
  generationEvents(
    @Req() request: AuthenticatedRequest,
    @Param('runId') runId: string,
    @Res() response: Response,
  ) {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    const unsubscribe = this.runs.subscribe(request.user.id, runId, (event) => {
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.cancelled') response.end();
    });
    request.on('close', unsubscribe);
  }

  @Get('products')
  products() { return this.studio.products(); }

  @Get('dashboard')
  dashboard(@Req() request: AuthenticatedRequest) { return this.studio.dashboard(request.user.id); }

  @Get('projects')
  projects(@Req() request: AuthenticatedRequest) { return this.studio.listProjects(request.user.id); }

  @Post('creation-sessions')
  createSession(@Req() request: AuthenticatedRequest, @Body() body: { productType?: ProductType }) {
    if (!body.productType) throw new BadRequestException({ code: 'PRODUCT_TYPE_REQUIRED' });
    return this.studio.createSession(request.user.id, body.productType);
  }

  @Put('creation-sessions/:sessionId')
  updateSession(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: { selections?: Record<string, unknown>; selectedTitle?: string; proposalContent?: string },
  ) {
    return this.studio.updateSession(request.user.id, sessionId, body);
  }

  @Post('creation-sessions/:sessionId/confirm')
  confirmSession(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: { selectedTitle?: string },
  ) {
    return this.studio.confirmSession(request.user.id, sessionId, body.selectedTitle ?? '');
  }

  @Get('projects/:projectId')
  project(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.studio.getProject(request.user.id, projectId);
  }

  @Delete('projects/:projectId')
  deleteProject(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.studio.deleteProject(request.user.id, projectId);
  }

  @Put('projects/:projectId/build/:stage')
  saveBuild(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('stage') stage: BuildStageKey,
    @Body() body: { content?: string; summary?: string },
  ) {
    if (typeof body.content !== 'string') throw new BadRequestException({ code: 'CONTENT_REQUIRED' });
    return this.studio.saveBuild(request.user.id, projectId, stage, body.content, body.summary ?? '');
  }

  @Post('projects/:projectId/build/:stage/confirm')
  confirmBuild(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('stage') stage: BuildStageKey) {
    return this.studio.confirmBuild(request.user.id, projectId, stage);
  }

  @Post('projects/:projectId/build/:stage/rewind')
  rewindBuild(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('stage') stage: BuildStageKey) {
    return this.studio.rewindBuild(request.user.id, projectId, stage);
  }

  @Put('projects/:projectId/episodes/:episodeNumber')
  saveEpisode(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('episodeNumber') episodeNumber: string,
    @Body() body: { content?: string; title?: string },
  ) {
    if (typeof body.content !== 'string') throw new BadRequestException({ code: 'CONTENT_REQUIRED' });
    return this.studio.saveEpisode(request.user.id, projectId, Number(episodeNumber), body.content, body.title);
  }

  @Post('projects/:projectId/episodes/:episodeNumber/annotations')
  addAnnotation(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('episodeNumber') episodeNumber: string,
    @Body() body: { startOffset?: number; endOffset?: number; quotedText?: string; note?: string },
  ) {
    return this.studio.addAnnotation(request.user.id, projectId, Number(episodeNumber), body);
  }

  @Delete('projects/:projectId/episodes/:episodeNumber/annotations/:annotationId')
  deleteAnnotation(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('episodeNumber') episodeNumber: string,
    @Param('annotationId') annotationId: string,
  ) {
    return this.studio.deleteAnnotation(request.user.id, projectId, Number(episodeNumber), annotationId);
  }

  @Post('projects/:projectId/episodes/:episodeNumber/confirm')
  confirmEpisode(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('episodeNumber') episodeNumber: string) {
    return this.studio.confirmEpisode(request.user.id, projectId, Number(episodeNumber));
  }
}
