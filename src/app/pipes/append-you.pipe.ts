import { Pipe, PipeTransform } from '@angular/core';

@Pipe( {
  name: 'appendYou',
  standalone: true
} )
export class AppendYouPipe implements PipeTransform {

  transform ( contact: any, userId: string ): string {
    if ( contact.id === userId ) {
      return `${contact.firstName} ${contact.lastName} (You)`;
    }
    return `${contact.firstName} ${contact.lastName}`;
  }

}
