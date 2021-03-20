
var tfrs = document.getElementsByClassName('tfr');
for(let i = 0; i < tfrs.length; i++) {
    let data = JSON.parse(tfrs[i].getElementsByClassName('data')[0].innerHTML);

    let weekday = luxon.DateTime.fromISO(data.start).toFormat('cccc');
    const start = luxon.DateTime.fromISO(data.start);
    const stop = luxon.DateTime.fromISO(data.stop);

    let post_message = '';
    let stop_day = stop.toFormat('cccc');
    if(stop_day !== weekday) post_message = ' <i>on ' + stop.toFormat('L-d') + '</i>';
    if(stop - start > 259200000) tfrs[i].getElementsByClassName('icon')[0].style.display = 'inline';

    tfrs[i].getElementsByClassName('start')[0].innerHTML = '<b>TFR Activates:</b> ' + start.toFormat('cccc LL-dd ttt');
    tfrs[i].getElementsByClassName('stop')[0].innerHTML = '<b>TFR Ends:</b> ' + stop.toFormat('ttt') + post_message;
}
