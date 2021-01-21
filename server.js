const http = require('http');
const app = new require('express')();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'pug');

app.get('/today', (req, res) => {
    res.render('today');
});



app.get('/upcheck', (req, res) => {
    red.send("Howdy, I'm still here!")
});

module.exports = {
    WebServer: app
}
