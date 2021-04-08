
var singleLaunches = document.getElementsByClassName('singleLaunchHeader');
var windowLaunches = document.getElementsByClassName('doubleLaunchHeader');
for(let i = 0; i < singleLaunches.length; i++) {
    let launch = singleLaunches[i];
    let time = luxon.DateTime.fromISO(launch.innerHTML);
    launch.innerHTML = time.toFormat("cccc, MMMM d 'at' ttt")
}

for(let i = 0; i < windowLaunches.length; i++) {
    let launch = windowLaunches[i];

}
