/**
 * Verbatim copies of the CSV files in src/assets/data, embedded so unit tests need no
 * filesystem access. Keep in sync if the bundled CSVs change.
 */
export const FIRST_CSV = `Entry,Date,Category,Month,Type,Notes
Sick Leave,"April 13, 2026",Sick Leave,Apr 2026,Full Day,
Sick Leave,"April 14, 2026",Sick Leave,Apr 2026,Full Day,
Casual Leave,"April 30, 2026",Casual Leave,Apr 2026,Half Day,
Sick Leave,"May 12, 2026",Sick Leave,May 2026,Full Day,
Casual Leave,"May 22, 2026",Casual Leave,May 2026,Full Day,
Casual Leave,"May 27, 2026",Casual Leave,May 2026,Half Day,
Casual Leave,"June 19, 2026",Casual Leave,Jun 2026,Full Day,
"Casual Leave ","June 24, 2026",Casual Leave,Jun 2026,Half Day,
Casual Leave,"June 25, 2026",Casual Leave,Jun 2026,Half Day,
Casual Leave,"July 10, 2026",Casual Leave,July 2026,Full Day,
Sick Leave,"June 1, 2026",Sick Leave,Jun 2026,Full Day,
Sick Leave,"June 11, 2026",Sick Leave,Jun 2026,Full Day,
"Sick Leave ","July 20, 2026",Sick Leave,July 2026,Full Day,
"Sick Leave ","July 31, 2026",Sick Leave,July 2026,Full Day,
Sick Leave,"October 15, 2026",Sick Leave,Oct 2026,Full Day,
" home renovation work","April 1, 2026",Work From Home,Apr 2026,Full Day,
" home renovation work","April 7, 2026",Work From Home,Apr 2026,Full Day,
sick leave converted to wfh,"April 20, 2026",Work From Home,Apr 2026,Full Day,
" home renovation work","April 22, 2026",Work From Home,Apr 2026,Full Day,
" home renovation work","April 23, 2026",Work From Home,Apr 2026,Full Day,
" home renovation work","April 24, 2026",Work From Home,Apr 2026,Full Day,
After marriage,"May 8, 2026",Work From Home,May 2026,Full Day,
personal reason,"June 24, 2026",Work From Home,Jun 2026,Half Day,
personal reason,"July 13, 2026",Work From Home,July 2026,Full Day,
"personal reason ","August 11, 2026",Work From Home,Aug 2026,Full Day,
personal reason,"October 9, 2026",Work From Home,Oct 2026,Half Day,
Compensatory Leave,"August 21, 2026",Compensatory Leave,Aug 2026,Full Day,
Compensatory Leave,"September 3, 2026",Compensatory Leave,Sep 2026,Full Day,
`;

export const ALL_CSV = `Entry,Category,Date,Month,Notes,Type
" home renovation work",Work From Home,"April 1, 2026",Apr 2026,,Full Day
Sick Leave,Sick Leave,"May 12, 2026",May 2026,,Full Day
" home renovation work",Work From Home,"April 7, 2026",Apr 2026,,Full Day
" home renovation work",Work From Home,"April 22, 2026",Apr 2026,,Full Day
" home renovation work",Work From Home,"April 23, 2026",Apr 2026,,Full Day
" home renovation work",Work From Home,"April 24, 2026",Apr 2026,,Full Day
Casual Leave,Casual Leave,"April 30, 2026",Apr 2026,,Half Day
Sick Leave,Sick Leave,"April 13, 2026",Apr 2026,,Full Day
Sick Leave,Sick Leave,"April 14, 2026",Apr 2026,,Full Day
Casual Leave,Casual Leave,"May 22, 2026",May 2026,,Full Day
Casual Leave,Casual Leave,"May 27, 2026",May 2026,,Half Day
Sick Leave,Sick Leave,"June 1, 2026",Jun 2026,,Full Day
Sick Leave,Sick Leave,"June 11, 2026",Jun 2026,,Full Day
sick leave converted to wfh,Work From Home,"April 20, 2026",Apr 2026,,Full Day
Casual Leave,Casual Leave,"June 19, 2026",Jun 2026,,Full Day
Casual Leave,Casual Leave,"June 25, 2026",Jun 2026,,Half Day
personal reason,Work From Home,"June 24, 2026",Jun 2026,,Half Day
"Casual Leave ",Casual Leave,"June 24, 2026",Jun 2026,,Half Day
personal reason,Work From Home,"July 13, 2026",July 2026,,Full Day
"Sick Leave ",Sick Leave,"July 20, 2026",July 2026,,Full Day
"personal reason ",Work From Home,"August 11, 2026",Aug 2026,,Full Day
"Sick Leave ",Sick Leave,"July 31, 2026",July 2026,,Full Day
Casual Leave,Casual Leave,"July 10, 2026",July 2026,,Full Day
Compensatory Leave,Compensatory Leave,"August 24, 2027",,,
Compensatory Leave,Compensatory Leave,"August 21, 2026",Aug 2026,,Full Day
After marriage,Work From Home,"May 8, 2026",May 2026,,Full Day
Compensatory Leave,Compensatory Leave,"September 3, 2026",Sep 2026,,Full Day
Sick Leave,Sick Leave,"October 15, 2026",Oct 2026,,Full Day
personal reason,Work From Home,"October 9, 2026",Oct 2026,,Half Day
`;

