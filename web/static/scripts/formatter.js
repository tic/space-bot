function formatDateToTimeOnly(date) {
  const minutes = date.getMinutes();
  return `${date.getHours()}:${minutes < 10 ? `0${minutes}` : minutes}`;
}

function formatDateToTimeOnlyWithSeconds(date) {
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${date.getHours()}:${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
}

function formatDateToTimeAndDateWithDay(date) {
  const daysOfTheWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${daysOfTheWeek[date.getDay()]}, ${date.getMonth() + 1}/${date.getDate()}/${
    date.getFullYear()} at ${formatDateToTimeOnly(date)
  }`;
}

function formatDateToTimeAndDateWithDayAndSeconds(date) {
  const daysOfTheWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${daysOfTheWeek[date.getDay()]}, ${date.getMonth() + 1}/${date.getDate()}/${
    date.getFullYear()} at ${formatDateToTimeOnlyWithSeconds(date)
  }`;
}

// eslint-disable-next-line no-undef
const timesToFormat = document.getElementsByClassName('formatTime');
for (let i = 0; i < timesToFormat.length; i++) {
  const element = timesToFormat[i];
  const rawDate = parseInt(element.innerHTML, 10);
  if (!element.innerHTML || !rawDate) {
    element.innerHTML = 'N/A';
  }
  const date = new Date(rawDate);
  // This self-comparison is actually not pointless,
  // because an invalid date will return NaN, and
  // NaN !== NaN --> true.
  // eslint-disable-next-line no-self-compare
  if (!date || date.getTime() !== date.getTime()) {
    element.innerHTML = 'N/A';
  }
  if (element.classList.contains('timeOnly')) {
    element.innerHTML = formatDateToTimeOnly(date);
  } else if (element.classList.contains('timeAndDateWithDay')) {
    element.innerHTML = formatDateToTimeAndDateWithDay(date);
  } else if (element.classList.contains('timeAndDateWithDayAndSeconds')) {
    element.innerHTML = formatDateToTimeAndDateWithDayAndSeconds(date);
  }
}

function updateLiveTimes() {
  // eslint-disable-next-line no-undef
  const elementsToUpdate = document.getElementsByClassName('liveTime');
  for (let i = 0; i < elementsToUpdate.length; i++) {
    const element = elementsToUpdate[i];
    if (element.classList.contains('starbaseTime')) {
      element.innerHTML = formatDateToTimeAndDateWithDayAndSeconds(new Date());
    } else {
      element.innerHTML = formatDateToTimeAndDateWithDayAndSeconds(new Date());
    }
  }
}

updateLiveTimes();
setInterval(updateLiveTimes, 1000);
