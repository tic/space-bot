/* eslint-disable no-var */
var document;
let launchData = [];
let lastUpdated = 0;

function getDateString(epochtime) {
  const d = epochtime ? new Date(epochtime) : new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const pad = (n) => (n < 10 && n > -1 ? `0${n}` : String(n));
function getPrettyTimeLong(epochtime) {
  const d = new Date(epochtime);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  return `${d.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

function setUpdateTime() {
  let text = '';
  if (!lastUpdated) {
    text = '<span>N/A</span>';
  } else {
    text = `<span>Last Updated: ${getPrettyTimeLong(lastUpdated)}</span>`;
  }

  document.getElementById('lastUpdated').innerHTML = text;
}

async function getData() {
  const { success, launches } = await fetch('/calendar-data').then((r) => r.json());
  lastUpdated = Date.now();
  setUpdateTime();
  return success ? launches : [];
}

function getLaunchEventRow(launch) {
  let displayDateAndTime = getPrettyTimeLong(launch.time.sortDate);
  if (launch.time.type === 'ESTIMATED') {
    displayDateAndTime = `
      <span style="font-weight: 700;">NET</span>
      &nbsp; ${displayDateAndTime.split(' ')[0]}
    `;
  }

  return `<div class="launchCard" key=${launch._id}>
    <div class="title">
      <b>${launch.vehicle} • ${launch.mission}</b>
    </div>
    <div>
      <b>${displayDateAndTime}</b>
    </div>
    <div>
      <i class="fa fa-location-arrow" aria-hidden="true" style="color: green;"></i>
      <span>${launch.launchSite}</span>
    </div>
  </div>`;
}

function getLaunchCalendarItem(launch) {
  const d = new Date(launch.time.startDate);
  const displayTime = launch.time.type === 'ESTIMATED' ? 'NET' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return `<div class="calendarEvent">
    <div class="time ${displayTime === 'NET' ? 'net' : ''}"}>${displayTime}</div>
    <div class="title">${launch.vehicle}</div>
  </div>`;
}

function buildPrimaryEvents() {
  const now = Date.now();
  const nowPlus24H = Date.now() + 84600000;
  const rowData = launchData
    .filter((launch) => launch.time.sortDate > now && launch.time.sortDate < nowPlus24H)
    .map((launch) => getLaunchEventRow(launch));

  document.getElementById('primaryEvents').innerHTML = rowData.join('');
}

function buildSecondaryEvents() {
  const todaysDateString = getDateString();
  const rowData = launchData
    .filter((launch) => getDateString(launch.time.sortDate) === todaysDateString)
    .map((launch) => getLaunchEventRow(launch));

  document.getElementById('secondaryEvents').innerHTML = rowData.join('');
}

function buildCalendar() {
  const calendar = document.getElementById('launchCalendar');
  const cells = Array.from(calendar.getElementsByClassName('calendarCell'));

  const centerpoint = Date.now();
  const centerpointDate = new Date(centerpoint);
  const d0 = new Date(centerpoint);
  d0.setDate(1);
  const monthStartIndex = d0.getDay();

  const d1 = new Date(centerpoint);
  d1.setDate(0);
  d1.setMonth(d1.getMonth() + 1);
  const monthEndIndex = d1.getDate() + monthStartIndex + 1;

  const d2 = new Date(centerpoint);
  d2.setDate(0);
  const prevMonthEndDate = d2.getDate();

  if (monthStartIndex > 0) {
    for (let i = monthStartIndex - 1; i > -1; i--) {
      const cell = cells[i];
      cell.classList.remove('activeMonth');
      cell.classList.remove('activeDay');
      cell.classList.remove('expiredDay');
      cell.classList.add('inactiveMonth');
      cell.getElementsByClassName('dayOfMonth')[0].innerHTML = prevMonthEndDate - monthStartIndex + 1 + i;
    }
  }

  for (let i = monthStartIndex; i < monthEndIndex; i++) {
    const cell = cells[i];
    cell.classList.remove('inactiveMonth');
    cell.classList.remove('activeDay');
    cell.classList.remove('expiredDay');
    cell.classList.add('activeMonth');
    const cellDate = i - monthStartIndex + 1;
    if (cellDate < centerpointDate.getDate()) {
      cell.classList.add('expiredDay');
    } else if (cellDate === centerpointDate.getDate()) {
      cell.classList.add('activeDay');
    }

    cell.getElementsByClassName('dayOfMonth')[0].innerHTML = cellDate;
  }

  for (let i = monthEndIndex; i < 42; i++) {
    const cell = cells[i];
    cell.classList.remove('activeMonth');
    cell.classList.remove('activeDay');
    cell.classList.remove('expiredDay');
    cell.classList.add('inactiveMonth');
    cell.getElementsByClassName('dayOfMonth')[0].innerHTML = i - monthEndIndex + 1;
  }

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const d3 = new Date(centerpoint);
    if (i < monthStartIndex) {
      // Search in previous month
      d3.setDate(1);
      d3.setMonth(d3.getMonth() - 1);
      d3.setDate(prevMonthEndDate - monthStartIndex + 1 + i);
    } else if (i >= monthEndIndex) {
      // Search in next month
      d3.setDate(1);
      d3.setMonth(d3.getMonth() + 1);
      d3.setDate(i - monthEndIndex + 1);
    } else {
      // Search in the current month
      d3.setDate(i - monthStartIndex + 1);
    }

    const dateString = getDateString(d3.getTime());
    const eventData = launchData
      .filter((launch) => dateString === getDateString(launch.time.sortDate))
      .map((launch) => getLaunchCalendarItem(launch));

    cell.getElementsByClassName('scheduleArea')[0].innerHTML = eventData.join('');
  }
}

function buildPage() {
  buildPrimaryEvents();
  buildSecondaryEvents();
  buildCalendar();
}

async function run() {
  launchData = await getData();
  buildPage();
}

(() => {
  run();
  setInterval(run, 60000);
})();
