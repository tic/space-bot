

var localText = document.getElementById('local');
var bocaText = document.getElementById('boca');
setInterval(() => {
    let localTime = luxon.DateTime.local();
    let bocaTime = localTime.setZone('America/Chicago');
    localText.innerHTML = localTime.toFormat('ccc L-d ttt');
    bocaText.innerHTML = bocaTime.toFormat('ccc L-d ttt');
}, 1000);

var tfrs = document.getElementsByClassName('tfr');
const now = luxon.DateTime.local();
for(let i = 0; i < tfrs.length; i++) {
    let tfr = JSON.parse(tfrs[i].getElementsByClassName('data')[0].innerHTML);
    const start = luxon.DateTime.fromISO(tfr.start);
    const stop = luxon.DateTime.fromISO(tfr.stop);
    if(stop > now) {
        if(start < now) {
            tfrs[i].style = 'border: 2px solid #0f0;'
        } else if(start.toFormat('yyyy-L-d') === now.toFormat('yyyy-L-d')) {
            tfrs[i].style = 'border: 2px solid #ff0;'
        } else {
            tfrs[i].style = 'display: none;';
        }
    }
    tfrs[i].getElementsByClassName('start')[0].innerHTML = start.toFormat('ccc L-d ttt');
    tfrs[i].getElementsByClassName('stop')[0].innerHTML = stop.toFormat('ccc L-d ttt');
}

var closures = document.getElementsByClassName('closure');
for(let i = 0; i < closures.length; i++) {
    let closure = JSON.parse(closures[i].getElementsByClassName('data')[0].innerHTML);
    const start = luxon.DateTime.fromISO(closure.start);
    const stop = luxon.DateTime.fromISO(closure.stop);
    console.log(closure.status)
    if(/canceled/i.test(closure.status)) {
        closures[i].style = 'border: 2px solid #f00;';
    } else {
        if(stop > now) {
            if(start < now) {
                closures[i].style = 'border: 2px solid #0f0;';
            } else {
                closures[i].style = 'border: 2px solid #ff0;';
            }
        }
    }
    closures[i].getElementsByClassName('start')[0].innerHTML = start.toFormat('ccc L-d ttt');
    closures[i].getElementsByClassName('stop')[0].innerHTML = stop.toFormat('ccc L-d ttt');
}
