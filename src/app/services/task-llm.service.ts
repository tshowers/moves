import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { MovesDataService } from './moves-data.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string; };
export type AssistantUiPatch = Partial<{
  assistantResponse: string;
  pendingAction: { action: string; param: any; } | null;
  inlineReply: any | null;
  showConfirmPrompt: boolean;
}>;

export type RunTaskArgs = {
  promptWithContext: string;
  userId: string;
  tenantId: string;
  history: AssistantMessage[];

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  onError: ( err: any ) => void;
};

/**
 * Port of TODD's TaskLLMService. The only real change from the original is
 * the project-lookup call: TODD's DataService.getProjectByName() becomes
 * MovesDataService.getProjectByName() here (added alongside this port,
 * client-side filter over getProjects() - same pattern as Network's
 * findContactsByName). Everything else, including the response-shape
 * handling, is unchanged.
 */
@Injectable( { providedIn: 'root' } )
export class TaskLLMService {
  constructor (
    private openAIService: OpenAIService,
    private dataService: MovesDataService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  run ( args: RunTaskArgs ): Subscription {
    const { promptWithContext, userId, tenantId, history, setLoading, patchState, onError } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    return this.openAIService.getTaskAssistantResponse( promptWithContext, userId, { history } ).subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        this.logger.info( '🧠 Task LLM Response:', res );

        const content: any = res?.parsedQuery ?? res ?? {};

        if ( content.route && content.action !== 'addTask' ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          if ( content.param && typeof content.param === 'object' ) {
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html = this.assistantBoxHelper.normalizeAssistantHtml(
              this.assistantBoxHelper.convertMarkdownToHtml(
                this.assistantBoxHelper.parseAssistantResponse( content )
              )
            ) || 'Open this view?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          patchState( { pendingAction: { action: 'navigate', param: routeStr } } );
        }

        if ( content.action ) {
          if ( content.action === 'addTask' ) {
            const { title, dueDate, priority } = content.param || {};
            const html = this.assistantBoxHelper.convertMarkdownToHtml(
              `📝 Would you like to create the move:\n\n**${title || 'Untitled'}**\n\nDue: **${dueDate || 'n/a'}**${priority ? `\n\nPriority: **${priority}**` : ''}`
            );
            patchState( {
              assistantResponse: html,
              pendingAction: { action: 'addTask', param: content.param },
              showConfirmPrompt: true,
              inlineReply: null
            } );
            return;
          }

          if ( ['showProjectByName', 'showProject', 'goProject'].includes( content.action ) ) {
            const projectName = ( content.param?.name ?? content.param ?? '' ).toString().trim();

            this.dataService
              .getProjectByName( tenantId, projectName )
              .then( ( found ) => {
                if ( found?.id ) {
                  patchState( {
                    assistantResponse: `📌 Showing project: <strong>${projectName}</strong>`,
                    pendingAction: { action: 'navigate', param: `/moves-view?project=${found.id}` },
                    showConfirmPrompt: true,
                    inlineReply: null
                  } );
                } else {
                  patchState( {
                    assistantResponse: `❓ I couldn't find a project named <strong>${projectName}</strong>.`,
                    pendingAction: null,
                    showConfirmPrompt: false,
                    inlineReply: null
                  } );
                }
              } )
              .catch( ( err: any ) => onError( err ) );

            return;
          }

          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml(
              this.assistantBoxHelper.parseAssistantResponse( content )
            )
          ) || 'Proceed with this action?';

          patchState( {
            pendingAction: { action: content.action, param: content.param },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        const message = this.assistantBoxHelper.parseAssistantResponse( content );
        if ( message ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml( message )
          );
          patchState( { assistantResponse: html } );
        }

        const shouldShowCta = !!( content.route && !content.param && content.action !== 'addTask' );
        patchState( { showConfirmPrompt: shouldShowCta } );
      },
      error: ( err: any ) => {
        onError( err );
      }
    } );
  }
}
