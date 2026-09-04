import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, of, switchMap, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contact } from '../models/contact.model';
import { LoggerService } from './logger.service';

interface TaskEmailPayload {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  contactName?: string;
  date?: string;
  from?: any;
}

const FOOTER = `<div style="text-align: center; margin-top: 20px; font-size: 0.8em; color: #777777; background-color: #f4f4f4; padding: 10px 0;">
  <p>
  © 2026
  <a href="https://taliferro.com" style="color: #1a73e8; text-decoration: none;">Taliferro</a>.
  Email sent from
  <a href="https://todd.taliferro.tech" style="color: #1a73e8; text-decoration: none;">TODD</a>.
  taliferro-tech-unsubscribe.
  </p>
  </div>`;

/**
 * Trimmed from services/email.service.ts (600+ lines covering campaign
 * drafting, question emails, etc.) - just sendTaskEmails(), the one
 * method task.component.ts calls when a Move is assigned to a contact
 * (`this.emailService.sendTaskEmails('Add', saved, matching, this.sender,
 * this.tenantId, this.userId)`), plus the sendEmail() POST it depends on.
 * Same `${backendURL}/send-email` endpoint, same HTML template.
 */
@Injectable( { providedIn: 'root' } )
export class MovesEmailService {
  constructor ( private http: HttpClient, private logger: LoggerService ) { }

  sendTaskEmails ( action: string, task: any, contacts: Contact[], sender: Contact, tenantId: string, userId: string ): Observable<any> {
    const subject = action === 'Add'
      ? `New Task Assigned: ${task.title}`
      : `Task Updated: ${task.title}`;

    let emailBody = `<p>Hello,</p>`;
    emailBody += action === 'Add'
      ? `<p>You have been assigned a new task:</p>`
      : `<p>A task assigned to you has been updated:</p>`;

    emailBody += `
      <p><strong>Task Title:</strong> ${task.title}</p>
      ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
      ${task.startDate ? `<p><strong>Start Date:</strong> ${task.startDate}</p>` : ''}
      ${task.dueDate ? `<p><strong>Due Date:</strong> ${task.dueDate}</p>` : ''}
      ${task.priority ? `<p><strong>Priority:</strong> ${task.priority}</p>` : ''}
      ${task.status ? `<p><strong>Status:</strong> ${task.status}</p>` : ''}
      ${task.url ? `<p><strong>More Details:</strong> <a href="${task.url}">View Task</a></p>` : ''}
    `;

    if ( task.images?.length )
      emailBody += `<p><strong>Images:</strong></p><ul>${task.images.map( ( img: any ) => `<li><a href="${img.src}">${img.alt || 'Image'}</a></li>` ).join( '' )}</ul>`;

    if ( task.documents?.length )
      emailBody += `<p><strong>Documents:</strong></p><ul>${task.documents.map( ( doc: any ) => `<li><a href="${doc.src}">${doc.name}</a></li>` ).join( '' )}</ul>`;

    emailBody += sender.signature ? sender.signature : `${sender.firstName} ${sender.lastName}`;
    emailBody += FOOTER;

    return from( contacts ).pipe(
      switchMap( ( contact ) => {
        if ( !contact.email ) {
          this.logger.warn( `No email found for contact: ${contact.firstName} ${contact.lastName}` );
          return of( null );
        }

        const email: TaskEmailPayload = {
          to: contact.email,
          subject,
          text: emailBody,
          html: `<div>${emailBody}</div>`,
          contactName: `${contact.firstName}`,
          date: new Date().toISOString(),
          from: sender.email,
        };

        return this.sendEmail( email, tenantId, userId ).pipe(
          tap( ( response ) => this.logger.log( `Email sent to ${email.to}. Response:`, response ) ),
          catchError( ( err ) => {
            this.logger.error( `Failed to send email to ${email.to}:`, err );
            return of( null );
          } ),
        );
      } ),
    );
  }

  private sendEmail ( email: TaskEmailPayload, tenantId: string, user: string ): Observable<any> {
    this.logger.info( 'SEND EMAIL', { tenantId, user, to: email.to, subject: email.subject } );
    return this.http.post( `${environment.backendURL}/send-email`, { ...email, tenantId } );
  }
}
