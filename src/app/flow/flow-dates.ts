const DAY = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses yyyy-mm-dd as a local date (not UTC midnight) and anything else via Date. */
export function toDate ( value: string | Date ): Date {
  if ( value instanceof Date ) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec( value || '' );
  if ( m ) return new Date( +m[1], +m[2] - 1, +m[3] );
  const d = new Date( value );
  return isNaN( d.getTime() ) ? new Date( 0 ) : d;
}

export function startOfDay ( value: string | Date ): Date {
  const d = toDate( value );
  return new Date( d.getFullYear(), d.getMonth(), d.getDate() );
}

export function addDays ( value: string | Date, days: number ): Date {
  const d = startOfDay( value );
  d.setDate( d.getDate() + days );
  return d;
}

/** Whole days from a to b (b later = positive), by calendar day. */
export function daysBetween ( a: string | Date, b: string | Date ): number {
  return Math.round( ( startOfDay( b ).getTime() - startOfDay( a ).getTime() ) / DAY );
}

export function isoDay ( value: string | Date ): string {
  const d = startOfDay( value );
  return `${d.getFullYear()}-${String( d.getMonth() + 1 ).padStart( 2, '0' )}-${String( d.getDate() ).padStart( 2, '0' )}`;
}

/** "Oct 13" */
export function fmtDay ( value: string | Date ): string {
  const d = toDate( value );
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Tue" */
export function fmtWeekday ( value: string | Date ): string {
  return WEEKDAYS[toDate( value ).getDay()];
}

/** "Mon Oct 19" */
export function fmtWeekdayDay ( value: string | Date ): string {
  return `${fmtWeekday( value )} ${fmtDay( value )}`;
}

/** "Tue, Oct 13" */
export function fmtLong ( value: string | Date ): string {
  return `${fmtWeekday( value )}, ${fmtDay( value )}`;
}

/** "9:02" */
export function fmtTime ( value: string | Date ): string {
  const d = toDate( value );
  return `${d.getHours() % 12 || 12}:${String( d.getMinutes() ).padStart( 2, '0' )}`;
}

/** Relative wording for a due date seen from today: "Today", "Thu", "Oct 21". */
export function fmtDue ( value: string | Date, now: Date ): string {
  const diff = daysBetween( now, value );
  if ( diff === 0 ) return 'Today';
  if ( diff === 1 ) return 'Tomorrow';
  if ( diff > 1 && diff < 7 ) return fmtWeekday( value );
  return fmtDay( value );
}

/** "Today 9:02", "Oct 5" */
export function fmtWhen ( value: string | Date, now: Date ): string {
  return daysBetween( value, now ) === 0 ? `Today ${fmtTime( value )}` : fmtDay( value );
}
