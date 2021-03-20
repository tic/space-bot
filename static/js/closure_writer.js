
var closures = document.getElementsByClassName('day');
for(let i = 0; i < closures.length; i++) {
    let day = JSON.parse(closures[i].getElementsByClassName('data')[0].innerHTML);

    let weekday = luxon.DateTime.fromISO(day.label);
    closures[i].getElementsByClassName('card-title')[0].innerHTML = weekday.toFormat('cccc L-d');
    weekday = weekday.toFormat('cccc');
    if(day.closures.length === 0) {
        closures[i].getElementsByClassName('warning')[0].style.display = 'block';
        continue;
    }

    for(let j = 0; j < day.closures.length; j++) {
        const start = luxon.DateTime.fromISO(day.closures[j].start);
        const stop = luxon.DateTime.fromISO(day.closures[j].stop);

        let pre_message = '';
        let post_message = '';
        let start_day = start.toFormat('cccc');
        let stop_day = stop.toFormat('cccc');
        if(start_day !== weekday) pre_message = ' <i>on ' + start_day + '</i>';
        if(stop_day !== weekday) post_message = ' <i>on ' + stop_day + '</i>';

        closures[i].getElementsByClassName('start')[j].innerHTML = 'Road closes: ' + start.toFormat('ttt') + pre_message;
        closures[i].getElementsByClassName('stop')[j].innerHTML = 'Road opens: ' + stop.toFormat('ttt') + post_message;
    }
}
