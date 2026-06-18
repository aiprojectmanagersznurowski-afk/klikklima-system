const fs = require('fs');
let code = fs.readFileSync('app/actions/calendar.ts', 'utf8');
code = code.replace('const busyIntervals = response.data.calendars?.[CALENDAR_ID]?.busy || [];', 'const busyIntervals = response.data.calendars?.[CALENDAR_ID]?.busy || [];\nconsole.log("BUSY:", busyIntervals);');
fs.writeFileSync('app/actions/calendar.ts', code);
